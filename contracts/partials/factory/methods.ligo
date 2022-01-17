function init_callback(
  const params          : callback_prm_t)
                        : list(operation) is
  block {
    assert(Tezos.sender = Tezos.self_address);
    var operations := list[
      call_add_liq(params.inv_prm, params.pool_address)
    ];
    function transfer_and_approve(
      var operations    : list(operation);
      const input       : nat * nat)
                        : list(operation) is
      block {
        const token = get_token_by_id(input.0, Some(params.tokens));
        case token of
        | Fa2(_) -> operations := concat_lists(operations, list[
          typed_approve(
            Tezos.self_address,
            params.pool_address,
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
            params.pool_address,
            input.1,
            token
          ) # operations;
          operations := typed_transfer(
            params.sender,
            Tezos.self_address,
            input.1,
            token
          ) # operations;
        }
        else skip;
      } with operations;
    operations := Map.fold(transfer_and_approve, params.inv_prm.in_amounts, operations);
  } with operations

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