function get_tokens_from_param(
      var result      : tmp_tokens_map_t;
      const value     : token_t)
                      : tmp_tokens_map_t is
      block {
        result.tokens[result.index] := value;
        result.index := result.index + 1n;
      }
      with result;

[@inline] function check_pool(
  const t_bytes         : bytes;
  const pool_map        : big_map(bytes, address))
                        : unit is
  case pool_map[t_bytes] of
  | None -> unit
  | Some(_address) -> failwith(Errors.Dex.pool_listed)
  end


[@inline] function call_add_liq(
  const params          : invest_param_t;
  const receiver        : address)
                        : operation is
  Tezos.transaction(
    params,
    0mutez,
    unwrap(
      (Tezos.get_entrypoint_opt("%invest", receiver): option(contract(invest_param_t))),
      "not_dex"
    )
  )

[@inline] function set_lambd_dex(
  const params          : big_map(nat, bytes);
  const receiver        : address)
                        : operation is
  Tezos.transaction(
    params,
    0mutez,
    unwrap(
      (Tezos.get_entrypoint_opt("%copy_dex_function", receiver): option(contract(big_map(nat, bytes)))),
      "not_dex"
    )
  )

[@inline] function set_init_function(
  const params          : bytes;
  var s                 : full_storage_t)
                        : option(bytes) is
  block {
    check_dev(s.storage.dev_store.dev_address);
    case s.init_func of
    | Some(_) -> failwith(Errors.Dex.func_set)
    | None -> skip
    end;
  } with Some(params)

[@inline] function run_init_func(
  const params          : pool_init_param_t;
  const s               : full_storage_t)
                        : fact_return_t is
  block{
    const lambda: bytes = unwrap(s.init_func, Errors.Dex.unknown_func);
    const func: init_func_t = unwrap((Bytes.unpack(lambda) : option(init_func_t)), Errors.Dex.wrong_use_function);
  } with func(params, s)

[@inline] function pack_pool_key(
  const deployer        : address;
  const tokens          : tokens_map_t)
                        : bytes is
  block {
    const key_to_pack: key_to_pack_t = record [ tokens=tokens; deployer=deployer ];
  } with Bytes.pack(key_to_pack);

function manage_startup_charges(
  const wl              : set(address);
  const price           : nat;
  const burn_rate       : nat;
  const quipu_token     : fa2_token_t;
  var operations        : list(operation);
  var quipu_rewards     : nat)
                        : record [ ops: list(operation); rewards: nat ] is
  block {
    if not (wl contains Tezos.sender)
    then {
      const to_burn = price * burn_rate / Constants.burn_rate_precision;
      const to_factory = abs(price - to_burn);
      operations := typed_transfer(
        Tezos.sender,
        Tezos.self_address,
        to_factory,
        Fa2(quipu_token)
      ) # operations;
      operations := typed_transfer(
        Tezos.sender,
        Constants.burn_address,
        to_burn,
        Fa2(quipu_token)
      ) # operations;
      quipu_rewards := quipu_rewards + to_factory;
    }
    else skip;
    const return = record[
      ops = operations;
      rewards = quipu_rewards;
    ]
  } with return