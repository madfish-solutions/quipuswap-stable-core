function start_dex_func(
  const params          : start_dex_prm_t;
  const s               : full_storage_t
): fact_return_t is
  block {
    const amnts = Map.map(function(const _i : nat; const v : input_t_v_t): nat is v.value, params);
    const tokens = Map.map(function(const _i : nat; const v : input_t_v_t): token_t is v.token, params);
    const pool_address = unwrap(s.storage.pool_to_address[Bytes.pack(tokens)], Errors.Factory.pool_not_listed);
    const deployer = unwrap(s.storage.deployers[pool_address], Errors.Factory.pool_not_listed);
    assert_with_error(deployer = Tezos.sender, Errors.Factory.not_deployer);
    // const prm = record [
    //     pool_id    = 0n;
    //     shares     = 0n;
    //     in_amounts = amnts;
    //     time_expiration = Tezos.now + 300;
    //     receiver = Some(Tezos.sender);
    //     referral = (None: option(address));
    //   ];
    var operations: list(operation) := list[
      // call_add_liq(prm, pool_address)
    ];
    function transfer_and_approve(
      var operations    : list(operation);
      const input       : nat * nat)
                        : list(operation) is
      block {
        const token = get_token_by_id(input.0, Some(tokens));
        case token of
        | Fa2(_) -> operations := concat_lists(operations, list[
          typed_approve(
            Tezos.self_address,
            pool_address,
            0n,
            token
          )
        ])
        | _ -> skip
        end;
        if input.1 > 0n
        then {
          operations := typed_approve(
            Tezos.self_address,
            pool_address,
            input.1,
            token
          ) # operations;
          operations := typed_transfer(
            Tezos.sender,
            Tezos.self_address,
            input.1,
            token
          ) # operations;
        }
        else skip;
      } with operations;
    operations := Map.fold(transfer_and_approve, amnts, operations);
    operations := set_lambd_dex(s.dex_lambdas, pool_address) # operations;
  } with (operations, s)

function claim_quipu(
  var s                 : full_storage_t)
                        : fact_return_t is
  block{
    const operations = list[
      typed_transfer(
        Tezos.self_address,
        s.storage.dev_store.dev_address,
        s.storage.quipu_rewards,
        Fa2(s.storage.quipu_token)
      )
    ];
    s.storage.quipu_rewards := 0n;
  } with (operations, s)

function add_rem_candidate(
  const params          : set_man_prm_t;
  var   whitelist       : set(address))
                        : set(address) is
  Set.update(params.candidate, params.add, whitelist)

function use_factory(
  const params          : use_factory_t;
  var s                 : full_storage_t)
                        : fact_return_t is
  block {
    check_dev(s.storage.dev_store.dev_address);
    case params of
    | Set_burn_rate(rate)   -> s.storage.burn_rate := rate
    | Set_price(price)      -> s.storage.init_price := price
    | Set_whitelist(params) -> s.storage.whitelist := add_rem_candidate(params, s.storage.whitelist)
    | _ -> skip
    end
  } with case params of
    | Claim_rewards -> claim_quipu(s)
    | _ -> (Constants.no_operations, s)
    end