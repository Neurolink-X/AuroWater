import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(req: NextRequest) {
  return withAuth(
    req,
    async () => {
      try {
        // Get KPIs
        const totalOrders = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM orders');

        const todaysOrders = await queryOne<{ count: number }>(
          `SELECT COUNT(*) as count
           FROM orders
           WHERE created_at >= CURRENT_DATE AND created_at < (CURRENT_DATE + INTERVAL '1 day')`
        );

        const totalRevenue = await queryOne<{ total: number }>(
          'SELECT SUM(total_amount) as total FROM orders WHERE status = \'COMPLETED\''
        );

        const revenueToday = await queryOne<{ total: number }>(
          `SELECT SUM(total_amount) as total
           FROM orders
           WHERE status = 'COMPLETED'
             AND created_at >= CURRENT_DATE AND created_at < (CURRENT_DATE + INTERVAL '1 day')`
        );

        const activeJobs = await queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM jobs WHERE status IN ('ACCEPTED', 'ON_THE_WAY', 'WORKING')`
        );

        const emergencyBookings = await queryOne<{ count: number }>(
          `SELECT COUNT(*) as count
           FROM orders
           WHERE emergency_charge > 0 AND status IN ('PENDING','ASSIGNED','ACCEPTED','IN_PROGRESS')`
        );

        const totalCustomers = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = \'CUSTOMER\'');
        const totalTechnicians = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = \'TECHNICIAN\'');

        // Lightweight charts (last 14 days): orders + revenue
        const ordersDaily = await query(
          `SELECT to_char(created_at::date, 'YYYY-MM-DD') as day, COUNT(*)::int as count
           FROM orders
           WHERE created_at >= (CURRENT_DATE - INTERVAL '13 day')
           GROUP BY 1
           ORDER BY 1 ASC`
        );

        const revenueDaily = await query(
          `SELECT to_char(created_at::date, 'YYYY-MM-DD') as day,
                  COALESCE(SUM(total_amount),0)::float as total
           FROM orders
           WHERE status = 'COMPLETED' AND created_at >= (CURRENT_DATE - INTERVAL '13 day')
           GROUP BY 1
           ORDER BY 1 ASC`
        );

        // Recent orders
        const recentOrders = await query(
          `SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at,
                  u.full_name as customer_name,
                  st.name as service_name
           FROM orders o
           JOIN users u ON o.customer_id = u.id
           JOIN service_types st ON o.service_type_id = st.id
           ORDER BY o.created_at DESC LIMIT 10`
        );

        const payload = {
          kpis: {
            total_orders: totalOrders?.count || 0,
            todays_orders: todaysOrders?.count || 0,
            total_revenue: totalRevenue?.total || 0,
            revenue_today: revenueToday?.total || 0,
            active_jobs: activeJobs?.count || 0,
            emergency_bookings: emergencyBookings?.count || 0,
            total_customers: totalCustomers?.count || 0,
            total_technicians: totalTechnicians?.count || 0,
          },
          recent_orders: recentOrders,
          charts: {
            orders_daily: ordersDaily,
            revenue_daily: revenueDaily,
          },
        };

        return NextResponse.json(successResponse(payload), { status: 200 });
      } catch (error: any) {
        console.error('Get dashboard error:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch dashboard'), { status: 500 });
      }
    },
    'ADMIN'
  );
}

