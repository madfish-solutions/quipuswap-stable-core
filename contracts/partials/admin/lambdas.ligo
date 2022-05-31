(* Updates manager storage *)
function add_rem_managers(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of [
  | Add_rem_managers(params) -> (
    Constants.no_operations,
    s with record [ managers = add_rem_candidate(params, s.managers) ]
  )
  | _ -> (Constants.no_operations, s)
  ]

(* set default referral *)
function set_default_referral(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of [
  | Set_default_referral(referral) -> (Constants.no_operations, s with record [ default_referral = referral ])
  | _ -> (Constants.no_operations, s)
  ]

(* Sets admin of contract *)
function set_admin(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of [
  | Set_admin(new_admin) -> (Constants.no_operations, s with record [ admin = new_admin ])
  | _ -> (Constants.no_operations, s)
  ]

(* DEX admin methods *)

(* ramping A constant *)
function ramp_A(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case p of [
    | Ramp_A(params) -> {
        var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);

        require(Tezos.now >= pool.initial_A_time + Constants.min_ramp_time, Errors.Dex.timestamp_error);
        require(params.future_time >= Tezos.now + Constants.min_ramp_time, Errors.Dex.timestamp_error); // dev: insufficient time

        const initial_A_f: nat = get_A(
          pool.initial_A_time,
          pool.initial_A_f,
          pool.future_A_time,
          pool.future_A_f
        );
        const future_A_f: nat = params.future_A * Constants.a_precision;

        assert((params.future_A > 0n) and (params.future_A <= Constants.max_a));

        if future_A_f >= initial_A_f
        then require(future_A_f <= initial_A_f * Constants.max_a_change, Errors.Dex.a_limit)
        else require(future_A_f * Constants.max_a_change >= initial_A_f, Errors.Dex.a_limit);

        s.pools[params.pool_id] := pool with record [
        initial_A_f = initial_A_f;
        future_A_f = future_A_f;
        initial_A_time = Tezos.now;
        future_A_time = params.future_time;
      ];
      }
    | _ -> skip
    ]
  } with (Constants.no_operations, s)

(* stop ramping A constant *)
function stop_ramp_A(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case p of [
    | Stop_ramp_A(pool_id) -> {
      var pool : pool_t := unwrap(s.pools[pool_id], Errors.Dex.pool_not_listed);
      const current_A_f: nat = get_A(
        pool.initial_A_time,
        pool.initial_A_f,
        pool.future_A_time,
        pool.future_A_f
      );
      s.pools[pool_id] := pool with record [
        initial_A_f = current_A_f;
        future_A_f = current_A_f;
        initial_A_time = Tezos.now;
        future_A_time = Tezos.now;
      ];
    }
    | _ -> skip
    ]
  } with (Constants.no_operations, s)

(* updates fees percents *)
function set_fees(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case p of [
    | Set_fees(params) -> {
      require(sum_all_fee(params.fee, 0n) < Constants.fee_denominator / 2n, Errors.Dex.fee_overflow);
      var pool := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      s.pools[params.pool_id] := pool with record[ fee = params.fee ];
    }
    | _ -> skip
    ]
  } with (Constants.no_operations, s)

(* Claimers of rewards *)

(* Developer *)
function claim_dev(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of [
    | Claim_developer(params) -> {
      const dev_address = get_dev_address(s);
      require(Tezos.sender = dev_address, Errors.Dex.not_developer);

      const bal = unwrap_or(s.dev_rewards[params.token], 0n);

      s.dev_rewards[params.token] := nat_or_error(bal - params.amount, Errors.Dex.balance_overflow);

      require(params.amount > 0n, Errors.Dex.zero_in);

      operations := typed_transfer(
        Tezos.self_address,
        dev_address,
        params.amount,
        params.token
      ) # operations;
    }
    | _ -> skip
    ]
  } with (operations, s)

