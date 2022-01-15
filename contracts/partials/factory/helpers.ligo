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