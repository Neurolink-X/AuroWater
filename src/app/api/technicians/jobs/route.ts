import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'PENDING';

      // Get technician record
      const technician = await queryOne(
        'SELECT id FROM technicians WHERE user_id = $1',
        [user.id]
      );

      if (!technician) {
        return NextResponse.json(errorResponse('Technician profile not found'), { status: 404 });
      }

      const jobs = await query(
        `SELECT j.*, o.id as order_id, o.total_amount, o.time_slot, o.scheduled_time,
                st.name as service_name, a.house_no, a.area, a.city, a.lat, a.lng,
                cu.full_name as customer_name, cu.phone as customer_phone
         FROM jobs j
         JOIN orders o ON j.order_id = o.id
         JOIN service_types st ON o.service_type_id = st.id
         JOIN addresses a ON o.address_id = a.id
         JOIN users cu ON o.customer_id = cu.id
         WHERE j.technician_id = $1 AND j.status = $2
         ORDER BY j.assigned_at ASC`,
        [technician.id, status]
      );

      return NextResponse.json(successResponse(jobs), { status: 200 });
    } catch (error: any) {
      console.error('Get jobs error:', error);
      return NextResponse.json(errorResponse(error.message || 'Failed to fetch jobs'), {
        status: 500,
      });
    }
  }, 'TECHNICIAN');
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const { job_id, action, notes } = await req.json();

      if (!job_id || !action) {
        return NextResponse.json(
          errorResponse('job_id and action are required'),
          { status: 400 }
        );
      }

      // Get technician record
      const technician = await queryOne(
        'SELECT id FROM technicians WHERE user_id = $1',
        [user.id]
      );

      if (!technician) {
        return NextResponse.json(errorResponse('Technician profile not found'), { status: 404 });
      }

      // Verify job belongs to technician
      const job = await queryOne('SELECT * FROM jobs WHERE id = $1 AND technician_id = $2', [
        job_id,
        technician.id,
      ]);

      if (!job) {
        return NextResponse.json(errorResponse('Job not found'), { status: 404 });
      }

      let new_status = job.status;

      if (action === 'accept') {
        new_status = 'ACCEPTED';
      } else if (action === 'reject') {
        new_status = 'REJECTED';
      } else if (action === 'on_the_way') {
        new_status = 'ON_THE_WAY';
      } else if (action === 'working') {
        new_status = 'WORKING';
      } else if (action === 'complete') {
        new_status = 'COMPLETED';
      }

      // Update job in transaction
      const updatedJob = await transaction(async (client) => {
        const updateTime =
          action === 'accept'
            ? 'accepted_at = CURRENT_TIMESTAMP,'
            : action === 'complete'
              ? 'completed_at = CURRENT_TIMESTAMP,'
              : '';

        const result = await client.query(
          `UPDATE jobs SET ${updateTime} status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
          [new_status, job_id]
        );

        // Record status change
        await client.query(
          `INSERT INTO job_status_history (job_id, status, notes) VALUES ($1, $2, $3)`,
          [job_id, new_status, notes || null]
        );

        // Update order status
        const orderResult = await client.query(
          'SELECT id FROM orders WHERE id = (SELECT order_id FROM jobs WHERE id = $1)',
          [job_id]
        );

        if (orderResult.rows.length > 0) {
          const orderId = orderResult.rows[0].id;
          let order_status = 'PENDING';

          if (new_status === 'ACCEPTED') {
            order_status = 'ACCEPTED';
          } else if (['ON_THE_WAY', 'WORKING'].includes(new_status)) {
            order_status = 'IN_PROGRESS';
          } else if (new_status === 'COMPLETED') {
            order_status = 'COMPLETED';
          }

          await client.query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
            order_status,
            orderId,
          ]);

          // Create notification for customer
          const custResult = await client.query(
            'SELECT customer_id FROM orders WHERE id = $1',
            [orderId]
          );

          if (custResult.rows.length > 0) {
            const customer_id = custResult.rows[0].customer_id;
            let title = '';
            let message = '';

            if (action === 'accept') {
              title = 'Job Accepted';
              message = 'Technician has accepted your job';
            } else if (action === 'on_the_way') {
              title = 'Technician On Way';
              message = 'Technician is on the way to your location';
            } else if (action === 'complete') {
              title = 'Job Completed';
              message = 'Your service has been completed';
            }

            if (title) {
              await client.query(
                `INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, 'JOB', $4)`,
                [customer_id, title, message, orderId]
              );
            }
          }
        }

        return result.rows[0];
      });

      return NextResponse.json(
        successResponse(updatedJob, 'Job updated successfully'),
        { status: 200 }
      );
    } catch (error: any) {
      console.error('Update job error:', error);
      return NextResponse.json(errorResponse(error.message || 'Failed to update job'), {
        status: 500,
      });
    }
  }, 'TECHNICIAN');
}
