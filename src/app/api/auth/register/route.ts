import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  ensureProfileForUser,
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/auth/ensure-profile';

import {
  seedSupplierRegistrationDefaults,
} from '@/lib/auth/seed-supplier-registration';

import {
  createSupabaseAnonClient,
  createSupabaseUserClient,
  isSupabaseConfigured,
} from '@/lib/db/supabase';

import {
  createServiceClient,
} from '@/utils/supabase/server';

import type {
  ProfileRow,
} from '@/lib/db/types';

import {
  needsApproval,
  uiRoleToDb,
} from '@/lib/auth/roles';

type ServiceClient =
  ReturnType<
    typeof createServiceClient
  >;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(
  value: unknown,
  max: number,
): string {
  return typeof value ===
    'string'
    ? value.trim().slice(0, max)
    : '';
}

function sameSecret(
  a: string,
  b: string,
): boolean {
  const x =
    Buffer.from(a);

  const y =
    Buffer.from(b);

  return (
    x.length === y.length &&
    timingSafeEqual(
      x,
      y,
    )
  );
}

export async function POST(
  req: NextRequest,
) {
  if (!isSupabaseConfigured()) {
    return jsonErr(
      'Supabase is not configured on the server',
      503,
      'MISCONFIG_ENV',
    );
  }

  let body: Record<
    string,
    unknown
  >;

  try {
    body =
      (await req.json()) as Record<
        string,
        unknown
      >;
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  const email =
    text(
      body.email,
      254,
    ).toLowerCase();

  const password =
    typeof body.password ===
    'string'
      ? body.password
      : '';

  const fullName =
    text(
      body.full_name,
      80,
    );

  const phone =
    typeof body.phone ===
    'string'
      ? body.phone
          .replace(/\D/g, '')
          .slice(-10)
      : '';

  const city =
    text(
      body.city,
      80,
    );

  const pincode =
    text(
      body.pincode,
      10,
    );

  const role =
    uiRoleToDb(
      typeof body.role ===
        'string'
        ? body.role
        : 'customer',
    );

  /*
   * Required fields.
   */
  if (
    !EMAIL_PATTERN.test(
      email,
    )
  ) {
    return jsonErr(
      'Enter a valid email address',
      400,
    );
  }

  if (
    fullName.length < 2
  ) {
    return jsonErr(
      'Enter your full name',
      400,
    );
  }

  if (
    !/^[6-9]\d{9}$/.test(
      phone,
    )
  ) {
    return jsonErr(
      'Enter a valid 10-digit Indian mobile number',
      400,
    );
  }

 if (role !== 'admin' && city.length < 2) {
  return jsonErr(
    'Enter your city',
    400,
  );
}

  /*
   * Password is required because AuroWater
   * uses Email + Password authentication.
   */
  if (!password) {
    return jsonErr(
      'Password is required',
      400,
    );
  }

  if (
    password.length < 8
  ) {
    return jsonErr(
      'Password must be at least 8 characters',
      400,
    );
  }

  if (
    password.length > 72
  ) {
    return jsonErr(
      'Password must be 72 characters or fewer',
      400,
    );
  }

  /*
   * Admin registration is invite-only.
   */
  if (
    role === 'admin'
  ) {
    const expected =
      process.env
        .ADMIN_INVITE_CODE
        ?.trim();

    const provided =
      typeof body.invite_code ===
      'string'
        ? body.invite_code.trim()
        : '';

    if (
      !expected ||
      !sameSecret(
        provided,
        expected,
      )
    ) {
      return jsonErr(
        'Admin registration requires a valid invite code',
        403,
      );
    }
  }

  let admin:
    | ServiceClient
    | null = null;

  try {
    admin =
      createServiceClient();
  } catch (error) {
    console.error(
      '[register] service client unavailable:',
      error,
    );
  }

  if (
    role === 'admin' &&
    !admin
  ) {
    return jsonErr(
      'Admin registration is not available right now',
      503,
      'SERVICE_ROLE_MISSING',
    );
  }

  /*
   * Check duplicate phone/email at the
   * application profile level.
   */
  if (admin) {
    const {
      data: phoneOwner,
      error:
        phoneLookupError,
    } = await admin
      .from('profiles')
      .select('id')
      .eq(
        'phone',
        phone,
      )
      .limit(1)
      .maybeSingle();

    if (phoneLookupError) {
      return jsonErr(
        'Could not verify phone number availability',
        502,
      );
    }

    if (phoneOwner) {
      return jsonErr(
        'This phone number already has an account. Sign in instead.',
        409,
        'PHONE_EXISTS',
      );
    }

    const {
      data: emailOwner,
    } = await admin
      .from('profiles')
      .select('id')
      .eq(
        'email',
        email,
      )
      .limit(1)
      .maybeSingle();

    if (emailOwner) {
      return jsonErr(
        'This email already has an account. Sign in instead.',
        409,
        'EMAIL_EXISTS',
      );
    }
  }

  /*
   * Never grant admin through metadata.
   */
  const userMeta = {
    full_name:
      fullName,

    phone,

    role:
      role === 'admin'
        ? 'customer'
        : role,

    city,

    pincode,

    business_name:
      typeof body.business_name ===
      'string'
        ? text(
            body.business_name,
            120,
          )
        : undefined,

    business_type:
      typeof body.business_type ===
      'string'
        ? text(
            body.business_type,
            60,
          )
        : undefined,

    gst_number:
      typeof body.gst_number ===
      'string'
        ? text(
            body.gst_number,
            20,
          )
        : undefined,

    vehicle_type:
      typeof body.vehicle_type ===
      'string'
        ? text(
            body.vehicle_type,
            60,
          )
        : undefined,

    license_number:
      typeof body.license_number ===
      'string'
        ? text(
            body.license_number,
            40,
          )
        : undefined,
  };

  const sb =
    createSupabaseAnonClient();

  let session =
    null as Awaited<
      ReturnType<
        typeof sb.auth.signInWithPassword
      >
    >['data']['session'];

  let authErrorMessage:
    | string
    | null = null;

  let authErrorCode:
    | string
    | undefined;

  /*
   * Admin creation uses the service-role
   * client because admin accounts must be
   * immediately confirmed and promoted.
   */
  if (admin) {
    try {
      const created =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata:
            userMeta,
        });

      if (
        created.error
      ) {
        authErrorMessage =
          created.error.message;

        authErrorCode =
          (
            created.error as {
              code?: string;
            }
          ).code;
      } else {
        const signed =
          await sb.auth.signInWithPassword({
            email,
            password,
          });

        if (
          signed.error
        ) {
          authErrorMessage =
            signed.error.message;

          authErrorCode =
            (
              signed.error as {
                code?: string;
              }
            ).code;
        } else {
          session =
            signed.data.session;
        }
      }
    } catch (error) {
      console.error(
        '[register] admin createUser failed:',
        error,
      );

      authErrorMessage =
        'We could not create your account right now. Please try again.';
    }
  } else {
    const {
      data,
      error,
    } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: userMeta,
      },
    });

    if (error) {
      authErrorMessage =
        error.message;

      authErrorCode =
        (
          error as {
            code?: string;
          }
        ).code;
    } else {
      session =
        data.session;
    }
  }

  if (
    !session?.access_token
  ) {
    const message =
      authErrorMessage ??
      'Registration failed';

    if (
      /already|registered|exists/i.test(
        message,
      )
    ) {
      return jsonErr(
        'This email already has an account. Sign in instead.',
        409,
        authErrorCode ??
          'EMAIL_EXISTS',
      );
    }

    /*
     * If email confirmation is enabled,
     * Supabase may create the account without
     * returning a session.
     */
    if (
      /confirm/i.test(
        message,
      )
    ) {
      return jsonErr(
        'Account created. Please confirm your email before signing in.',
        201,
        'EMAIL_CONFIRMATION_REQUIRED',
      );
    }

  return jsonErr(
  /password/i.test(message)
    ? 'Your password could not be accepted. Please use a stronger password and try again.'
    : 'We could not create your account right now. Please try again.',
  400,
  authErrorCode,
);
  }

  const userSb =
    createSupabaseUserClient(
      session.access_token,
    );

  const {
    data: profile,
    error: profileError,
  } = await userSb
    .from('profiles')
    .select('*')
    .eq(
      'id',
      session.user.id,
    )
    .maybeSingle();

  if (profileError) {
    const code =
      (
        profileError as {
          code?: string;
        }
      ).code;

    if (code === '42501') {
      return jsonErr(
        'Forbidden',
        403,
      );
    }

    if (
      isProfilesSchemaMissingError(
        profileError,
      )
    ) {
      return jsonErr(
        `${profileTableUnavailableMessage(
          profileError,
        )} Then register again.`,
        503,
        'DB_NOT_READY',
      );
    }

    return jsonErr(
      'Could not load profile',
      502,
    );
  }

  let resolved =
    profile as ProfileRow | null;

  if (!resolved) {
    // Registration has already validated the requested role and, for admin,
    // verified the invite code. Pass that trusted server-side role into repair.
    resolved =
      await ensureProfileForUser(
        session.user,
        { role, city },
      );
  }

  if (!resolved) {
    if (!admin) {
      return jsonErr(
        'Account created but profile could not be finalized. Please sign in again.',
        503,
        'PROFILE_NOT_READY',
      );
    }

    return jsonErr(
      'Account created but profile could not be created. Apply the required database migrations, then sign in again.',
      503,
      'PROFILE_NOT_READY',
    );
  }

  /*
   * Server-side admin promotion.
   */
  if (
    role === 'admin' &&
    resolved.role !==
      'admin' &&
    admin
  ) {
    const {
      data: promoted,
      error:
        promotionError,
    } = await admin
      .from('profiles')
      .update({
        role: 'admin',
        status: 'active',
        is_active: true,
      })
      .eq(
        'id',
        resolved.id,
      )
      .select('*')
      .maybeSingle();

    if (
      promotionError ||
      !promoted
    ) {
      console.error(
        '[register] admin promotion failed:',
        promotionError,
      );

      return jsonErr(
        'Your account was created but admin access could not be granted. Contact support.',
        500,
      );
    }

    resolved =
      promoted as ProfileRow;
  }

  /*
   * Supplier defaults.
   */
  if (
    resolved.role ===
    'supplier'
  ) {
    await seedSupplierRegistrationDefaults(
      resolved.id,
    );
  }

  /*
   * City + approval state.
   */
  const patch:
    Record<
      string,
      unknown
    > = {};

  if (city) {
    patch.city =
      city;
  }

  if (pincode) {
    patch.pincode =
      pincode;
  }

  if (
    needsApproval(
      resolved.role,
    )
  ) {
    patch.status =
      'pending';
  }

  if (
    Object.keys(
      patch,
    ).length > 0
  ) {
    const writer =
      admin ?? userSb;

    const {
      data: patched,
      error:
        patchError,
    } = await writer
      .from('profiles')
      .update(patch)
      .eq(
        'id',
        resolved.id,
      )
      .select('*')
      .maybeSingle();

    if (patchError) {
      console.error(
        '[register] profile update failed:',
        patchError.message,
      );
    } else if (
      patched
    ) {
      resolved =
        patched as ProfileRow;
    }
  }

  return jsonOk(
    {
      access_token:
        session.access_token,

      refresh_token:
        session.refresh_token,

      expires_at:
        session.expires_at ??
        null,

      profile:
        resolved,

      pending:
        needsApproval(
          resolved.role,
        ),
    },
    201,
  );
}








// import { timingSafeEqual } from 'crypto';
// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import {
//   ensureProfileForUser,
//   isProfilesSchemaMissingError,
//   profileTableUnavailableMessage,
// } from '@/lib/auth/ensure-profile';
// import { seedSupplierRegistrationDefaults } from '@/lib/auth/seed-supplier-registration';
// import { createSupabaseAnonClient, createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
// import { createServiceClient } from '@/utils/supabase/server';
// import type { ProfileRow } from '@/lib/db/types';
// import { needsApproval, phoneToAuthEmail, uiRoleToDb } from '@/lib/auth/roles';

// /*
//  * IMPORTANT: this file may export ONLY HTTP handlers (POST).
//  *
//  * What this route guarantees:
//  *  - Admin accounts are created ONLY here, and only with a valid ADMIN_INVITE_CODE.
//  *    The admin role is granted by the server after that check (never from signup metadata).
//  *  - profiles.status only allows: active, suspended, pending, banned.
//  *    Suppliers and technicians therefore start as "pending" until approved.
//  *  - Only real profiles columns are written. Business details stay in the login's
//  *    metadata (user_metadata) because profiles has no columns for them.
//  */

// type ServiceClient = ReturnType<typeof createServiceClient>;

// const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// const PENDING_STATUS = 'pending';

// function text(value: unknown, max: number): string {
//   return typeof value === 'string' ? value.trim().slice(0, max) : '';
// }

// function sameSecret(a: string, b: string): boolean {
//   const x = Buffer.from(a);
//   const y = Buffer.from(b);
//   return x.length === y.length && timingSafeEqual(x, y);
// }

// export async function POST(req: NextRequest) {
//   if (!isSupabaseConfigured()) {
//     return jsonErr('Supabase is not configured on the server', 503, 'MISCONFIG_ENV');
//   }

//   let body: Record<string, unknown>;
//   try {
//     body = (await req.json()) as Record<string, unknown>;
//   } catch {
//     return jsonErr('Invalid JSON body', 400);
//   }
//   if (!body || typeof body !== 'object' || Array.isArray(body)) {
//     return jsonErr('Invalid JSON body', 400);
//   }

//   const emailRaw = text(body.email, 254).toLowerCase();
//   const password = typeof body.password === 'string' ? body.password : '';
//   const full_name = text(body.full_name, 80);
//   const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '').slice(-10) : '';
//   const city = text(body.city, 80);
//   const pincode = text(body.pincode, 10);
//   const role = uiRoleToDb(typeof body.role === 'string' ? body.role : 'customer');
//   const email = emailRaw || (phone ? phoneToAuthEmail(phone) : '');

//   if (role === 'admin') {
//     const expected = process.env.ADMIN_INVITE_CODE?.trim();
//     const provided = typeof body.invite_code === 'string' ? body.invite_code.trim() : '';
//     if (!expected || !sameSecret(provided, expected)) {
//       return jsonErr('Admin registration requires a valid invite code', 403);
//     }
//   }

//   if (!password || !full_name || !phone) {
//     return jsonErr('full_name, phone, and password are required', 400);
//   }
//   if (full_name.length < 2) {
//     return jsonErr('Enter your full name', 400);
//   }
//   if (!/^[6-9]\d{9}$/.test(phone)) {
//     return jsonErr('Enter a valid 10-digit Indian mobile number', 400);
//   }
//   if (emailRaw && !EMAIL_PATTERN.test(emailRaw)) {
//     return jsonErr('Enter a valid email address', 400);
//   }
//   if (password.length < 8) {
//     return jsonErr('Password must be at least 8 characters', 400);
//   }
//   if (password.length > 72) {
//     return jsonErr('Password must be 72 characters or fewer', 400);
//   }

//   let admin: ServiceClient | null = null;
//   try {
//     admin = createServiceClient();
//   } catch (error) {
//     console.error('[register] service client unavailable:', error);
//   }

//   if (role === 'admin' && !admin) {
//     return jsonErr('Admin registration is not available right now', 503, 'SERVICE_ROLE_MISSING');
//   }

//   // One phone number, one account (the login email may be a real email or a phone-based one).
//   if (admin) {
//     const { data: phoneOwner } = await admin
//       .from('profiles')
//       .select('id')
//       .eq('phone', phone)
//       .limit(1)
//       .maybeSingle();
//     if (phoneOwner) {
//       return jsonErr('This phone or email already has an account. Sign in instead.', 400, 'email_exists');
//     }
//   }

//   // The admin role is never sent in signup metadata: it is granted below, after the invite check.
//   const userMeta = {
//     full_name,
//     phone,
//     role: role === 'admin' ? 'customer' : role,
//     city,
//     pincode,
//     business_name: typeof body.business_name === 'string' ? text(body.business_name, 120) : undefined,
//     business_type: typeof body.business_type === 'string' ? text(body.business_type, 60) : undefined,
//     gst_number: typeof body.gst_number === 'string' ? text(body.gst_number, 20) : undefined,
//     vehicle_type: typeof body.vehicle_type === 'string' ? text(body.vehicle_type, 60) : undefined,
//     license_number: typeof body.license_number === 'string' ? text(body.license_number, 40) : undefined,
//   };

//   const sb = createSupabaseAnonClient();
//   let session = null as Awaited<ReturnType<typeof sb.auth.signInWithPassword>>['data']['session'];
//   let authErrorMessage: string | null = null;
//   let authErrorCode: string | undefined;

//   if (admin) {
//     try {
//       const created = await admin.auth.admin.createUser({
//         email,
//         password,
//         email_confirm: true,
//         user_metadata: userMeta,
//       });
//       if (created.error) {
//         authErrorMessage = created.error.message;
//         authErrorCode = (created.error as { code?: string }).code;
//       } else {
//         const signed = await sb.auth.signInWithPassword({ email, password });
//         if (signed.error) {
//           authErrorMessage = signed.error.message;
//           authErrorCode = (signed.error as { code?: string }).code;
//         } else {
//           session = signed.data.session;
//         }
//       }
//     } catch (error) {
//       console.error('[register] createUser failed:', error);
//       authErrorMessage = 'We could not create your account right now. Please try again.';
//     }
//   } else {
//     // No service key on the server: fall back to the public signup (customers, suppliers, technicians only).
//     const { data, error } = await sb.auth.signUp({
//       email,
//       password,
//       options: { data: userMeta },
//     });
//     if (error) {
//       authErrorMessage = error.message;
//       authErrorCode = (error as { code?: string }).code;
//     } else {
//       session = data.session;
//     }
//   }

//   if (!session?.access_token) {
//     const msg = authErrorMessage ?? 'Registration failed';
//     if (/already|registered|exists/i.test(msg)) {
//       return jsonErr('This phone or email already has an account. Sign in instead.', 400, authErrorCode);
//     }
//     return jsonErr(msg, 400, authErrorCode);
//   }

//   const userSb = createSupabaseUserClient(session.access_token);
//   const { data: profile, error: pErr } = await userSb
//     .from('profiles')
//     .select('*')
//     .eq('id', session.user.id)
//     .maybeSingle();

//   if (pErr) {
//     const code = (pErr as { code?: string }).code;
//     if (code === '42501') {
//       return jsonErr(pErr.message || 'Forbidden', 403);
//     }
//     if (isProfilesSchemaMissingError(pErr)) {
//       return jsonErr(
//         `${profileTableUnavailableMessage(pErr)} Then register again.`,
//         503,
//         'DB_NOT_READY'
//       );
//     }
//     return jsonErr(pErr.message || 'Could not load profile', 502);
//   }

//   let resolved = profile as ProfileRow | null;
//   if (!resolved) {
//     resolved = await ensureProfileForUser(session.user);
//   }

//   if (!resolved) {
//     if (!admin) {
//       return jsonErr(
//         'Account created but profile could not be finalized. Set SUPABASE_SERVICE_ROLE_KEY on the server, then sign in.',
//         503,
//         'SERVICE_ROLE_MISSING'
//       );
//     }
//     return jsonErr(
//       'Account created but profile could not be created. Apply migrations (001–006) and sql/004_functions.sql, then sign in.',
//       404
//     );
//   }

//   // Admin: the invite code was verified at the top, so the server grants the role here.
//   if (role === 'admin' && resolved.role !== 'admin' && admin) {
//     const { data: promoted, error: promoteErr } = await admin
//       .from('profiles')
//       .update({ role: 'admin', status: 'active' })
//       .eq('id', resolved.id)
//       .select('*')
//       .maybeSingle();
//     if (promoteErr || !promoted) {
//       console.error('[register] admin promotion failed:', promoteErr?.message);
//       return jsonErr('Your account was created but admin access could not be granted. Contact support.', 500);
//     }
//     resolved = promoted as ProfileRow;
//   }

//   if (resolved.role === 'supplier') {
//     await seedSupplierRegistrationDefaults(resolved.id);
//   }

//   const patch: Record<string, unknown> = {};
//   if (city) patch.city = city;
//   if (needsApproval(resolved.role)) patch.status = PENDING_STATUS;

//   if (Object.keys(patch).length > 0) {
//     const writer = admin ?? userSb;
//     const { data: patched, error: patchError } = await writer
//       .from('profiles')
//       .update(patch)
//       .eq('id', resolved.id)
//       .select('*')
//       .maybeSingle();
//     if (patchError) {
//       console.error('[register] profile update skipped:', patchError.message);
//     } else if (patched) {
//       resolved = patched as ProfileRow;
//     }
//   }

//   return jsonOk(
//     {
//       access_token: session.access_token,
//       refresh_token: session.refresh_token,
//       expires_at: session.expires_at ?? null,
//       profile: resolved,
//       pending: needsApproval(resolved.role),
//     },
//     201
//   );
// }

