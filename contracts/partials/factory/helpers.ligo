function get_tokens_from_param(
      var result      : tmp_tkns_map_t;
      const value     : token_t)
                      : tmp_tkns_map_t is
      block {
        result.tokens[result.index] := value;
        result.index := result.index + 1n;
      }
      with result;

function check_pool(
  const t_bytes         : bytes;
  const pool_map        : big_map(bytes, address))
                        : unit is
  case pool_map[t_bytes] of
  | None -> unit
  | Some(_address) -> failwith(Errors.Dex.pool_listed)
  end


function call_add_liq(
  const params          : invest_prm_t;
  const receiver        : address)
                        : operation is
  Tezos.transaction(
    params,
    0mutez,
    unwrap(
      (Tezos.get_entrypoint_opt("%invest", receiver): option(contract(invest_prm_t))),
      "not_dex"
    )
  )

function set_init_function(
  const params          : bytes;
  var s                 : full_storage_t)
                        : option(bytes) is
  block {
    check_dev(s.storage.dev_store.dev_address);
    case s.init_func of
    | Some(_) -> failwith(Errors.Dex.func_set)
    | None -> skip
    end
  } with Some(params)

function run_init_func(
  const params          : pool_init_prm_t;
  const s               : full_storage_t)
                        : fact_return_t is
  block{
    const lambda: bytes = unwrap(s.init_func, Errors.Dex.unknown_func);
    const func: init_func_t = unwrap((Bytes.unpack(lambda) : option(init_func_t)), Errors.Dex.wrong_use_function);
  } with func(params, s)