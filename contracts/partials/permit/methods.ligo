(*

The function is responsible for fiding the appropriate method
based on the provided index.

*)
[@inline] function call_permit(
  const p               : permit_action_t;
  var s                 : full_storage_t;
  const action          : full_action_t)
                        : full_return_t is
  block {
    const idx : nat = case p of
    | Permit(_)     -> 0n
    | Set_expiry(_) -> 1n
    end;

    const lambda_bytes : bytes = unwrap(s.permit_lambdas[idx], Errors.Dex.unknown_func);
    const func: permit_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(permit_func_t)), Errors.Dex.wrong_use_function);
  } with (Constants.no_operations, func(p, s, action))
