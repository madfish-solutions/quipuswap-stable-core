(* This methods called only by dev and modifies only `storage` property of full storage *)
[@inline] function call_dev(
  const p               : dev_action_t;
  var s                 : dev_storage_t)
                        : dev_storage_t is
  block {

    check_dev(s.dev_address);

    const idx : nat = case p of
    | Set_dev_address(_)  -> 0n
    | Set_dev_fee(_)      -> 1n
    end;

    const lambda_bytes : bytes = unwrap(s.dev_lambdas[idx], Errors.Dex.unknown_func);
    const func: dev_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(dev_func_t)), Errors.Dex.wrong_use_function);
  } with func(p, s)