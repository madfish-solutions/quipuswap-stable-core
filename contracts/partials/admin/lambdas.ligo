(* Updates manager storage *)
function add_rem_managers(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of
  | Add_rem_managers(params) -> (
    Constants.no_operations,
    s with record [ managers = add_rem_candidate(params, s.managers) ]
  )
  | _ -> (Constants.no_operations, s)
  end

(* set default referral *)
function set_default_referral(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of
  | Set_default_referral(params) -> (Constants.no_operations, s with record [ default_referral = params ])
  | _ -> (Constants.no_operations, s)
  end

(* Sets admin of contract *)
function set_admin(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of
  | Set_admin(new_admin) -> (Constants.no_operations, s with record [ admin = new_admin ])
  | _ -> (Constants.no_operations, s)
  end

(* DEX admin methods *)

(* ramping A constant *)
function ramp_A(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case p of
    | Ramp_A(params) -> {
        var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);

        assert_with_error(Tezos.now >= pool.initial_A_time + Constants.min_ramp_time, Errors.Dex.timestamp_error);
        assert_with_error(params.future_time >= Tezos.now + Constants.min_ramp_time, Errors.Dex.timestamp_error); // dev: insufficient time

        const initial_A: nat = get_A(
          pool.initial_A_time,
          pool.initial_A,
          pool.future_A_time,
          pool.future_A
        );
        const future_A_p: nat = params.future_A * Constants.a_precision;

        assert((params.future_A > 0n) and (params.future_A <= Constants.max_a));

        if future_A_p >= initial_A
        then assert_with_error(future_A_p <= initial_A * Constants.max_a_change, Errors.Dex.a_limit)
        else assert_with_error(future_A_p * Constants.max_a_change >= initial_A, Errors.Dex.a_limit);

        s.pools[params.pool_id] := pool with record [
        initial_A = initial_A;
        future_A = future_A_p;
        initial_A_time = Tezos.now;
        future_A_time = params.future_time;
      ];
      }
    | _ -> skip
    end
  } with (Constants.no_operations, s)

(* stop ramping A constant *)
function stop_ramp_A(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case p of
    | Stop_ramp_A(pool_id) -> {
      var pool : pool_t := unwrap(s.pools[pool_id], Errors.Dex.pool_not_listed);
      const current_A: nat = get_A(
        pool.initial_A_time,
        pool.initial_A,
        pool.future_A_time,
        pool.future_A
      );
      s.pools[pool_id] := pool with record [
        initial_A = current_A;
        future_A = current_A;
        initial_A_time = Tezos.now;
        future_A_time = Tezos.now;
      ];
    }
    | _ -> skip
    end
  } with (Constants.no_operations, s)

(* updates fees percents *)
function set_fees(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case p of
    | Set_fees(params) -> {
      assert_with_error(sum_all_fee(params.fee, get_dev_fee(s)) <= Constants.fee_denominator, Errors.Dex.fee_overflow);
      var pool := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      s.pools[params.pool_id] := pool with record[ fee = params.fee ];
    }
    | _ -> skip
    end
  } with (Constants.no_operations, s)

(* Claimers of rewards *)

(* Developer *)
function claim_dev(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Claim_developer(params) -> {
      check_dev(get_dev_address(s));

      const bal = unwrap_or(s.dev_rewards[params.token], 0n);

      s.dev_rewards[params.token] := nat_or_error(bal - params.amount, Errors.Dex.balance_overflow);

      assert_with_error(params.amount > 0n, Errors.Dex.zero_in);

      operations := typed_transfer(
        Tezos.self_address,
        get_dev_address(s),
        params.amount,
        params.token
      ) # operations;
    }
    | _ -> skip
    end;
  } with (operations, s)

