DO $$
DECLARE
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_co_a uuid := 'aaaaaaa1-1111-1111-1111-111111111111';
  v_co_b uuid := 'bbbbbbb2-2222-2222-2222-222222222222';
  v_cid uuid;
  v_admin boolean;
  v_ooc boolean;
  v_billing boolean;
  v_disp boolean;
BEGIN
  -- Insert auth.users entry directly (test fixture)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test4a@example.com', '', now(), now(), now(), '{}', '{}')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.companies (id, name) VALUES (v_co_a, 'TEST_4A_CompanyA'), (v_co_b, 'TEST_4A_CompanyB')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (user_id, full_name) VALUES (v_user, 'Test 4A User')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.company_memberships (user_id, company_id, role) VALUES
    (v_user, v_co_a, 'owner'),
    (v_user, v_co_b, 'biller');

  -- Impersonate
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user::text, 'role','authenticated')::text, true);

  -- TEST 1: no active company, multi-membership -> NULL
  SELECT public.get_my_company_id() INTO v_cid;
  RAISE NOTICE 'TEST 1 (no active, multi-membership): get_my_company_id = % (expect NULL)', v_cid;
  IF v_cid IS NOT NULL THEN RAISE EXCEPTION 'TEST 1 FAILED'; END IF;

  -- TEST 2: with no active, role checks return FALSE
  SELECT public.is_admin(), public.is_owner_or_creator() INTO v_admin, v_ooc;
  RAISE NOTICE 'TEST 2 (no active): is_admin=% (expect F), is_owner_or_creator=% (expect F)', v_admin, v_ooc;
  IF v_admin OR v_ooc THEN RAISE EXCEPTION 'TEST 2 FAILED'; END IF;

  -- Switch active to A (owner)
  UPDATE public.profiles SET active_company_id = v_co_a WHERE user_id = v_user;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user::text, 'role','authenticated')::text, true);

  SELECT public.get_my_company_id(), public.is_admin(), public.is_owner_or_creator(),
         public.is_billing(), public.is_dispatcher()
  INTO v_cid, v_admin, v_ooc, v_billing, v_disp;
  RAISE NOTICE 'TEST 3 (active=A as owner): cid=% admin=% ooc=% billing=% disp=% (expect A,T,T,T,T)',
    v_cid, v_admin, v_ooc, v_billing, v_disp;
  IF v_cid <> v_co_a OR NOT v_admin OR NOT v_ooc OR NOT v_billing OR NOT v_disp THEN
    RAISE EXCEPTION 'TEST 3 FAILED';
  END IF;

  -- Switch active to B (biller)
  UPDATE public.profiles SET active_company_id = v_co_b WHERE user_id = v_user;

  SELECT public.get_my_company_id(), public.is_admin(), public.is_owner_or_creator(),
         public.is_billing(), public.is_dispatcher()
  INTO v_cid, v_admin, v_ooc, v_billing, v_disp;
  RAISE NOTICE 'TEST 4 (active=B as biller): cid=% admin=% ooc=% billing=% disp=% (expect B,F,F,T,F)',
    v_cid, v_admin, v_ooc, v_billing, v_disp;
  IF v_cid <> v_co_b OR v_admin OR v_ooc OR NOT v_billing OR v_disp THEN
    RAISE EXCEPTION 'TEST 4 FAILED';
  END IF;

  -- TEST 5: manager-only on A
  DELETE FROM public.company_memberships WHERE user_id = v_user AND company_id = v_co_a AND role = 'owner';
  INSERT INTO public.company_memberships (user_id, company_id, role) VALUES (v_user, v_co_a, 'manager');
  UPDATE public.profiles SET active_company_id = v_co_a WHERE user_id = v_user;

  SELECT public.get_my_company_id(), public.is_admin(), public.is_owner_or_creator(),
         public.is_billing(), public.is_dispatcher()
  INTO v_cid, v_admin, v_ooc, v_billing, v_disp;
  RAISE NOTICE 'TEST 5 (active=A as manager): cid=% admin=% ooc=% billing=% disp=% (expect A,T,F,T,T)',
    v_cid, v_admin, v_ooc, v_billing, v_disp;
  IF v_cid <> v_co_a OR NOT v_admin OR v_ooc OR NOT v_billing OR NOT v_disp THEN
    RAISE EXCEPTION 'TEST 5 FAILED';
  END IF;

  RAISE NOTICE 'ALL 5 TESTS PASSED';

  -- Cleanup
  DELETE FROM public.company_memberships WHERE user_id = v_user;
  DELETE FROM public.profiles WHERE user_id = v_user;
  DELETE FROM public.companies WHERE id IN (v_co_a, v_co_b);
  DELETE FROM auth.users WHERE id = v_user;
END$$;