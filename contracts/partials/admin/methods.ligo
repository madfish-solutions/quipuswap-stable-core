[@inline]
function call_admin(
  const p               : admin_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    is_admin(s.storage.admin);
    const idx : nat = case p of
    | Add_rem_managers(_) -> 0n
    | Set_dev_address(_)  -> 1n
    | Set_reward_rate(_)  -> 2n
    | Set_admin(_)        -> 3n
    end;

    const lambda_bytes : bytes = unwrap(s.admin_lambdas[idx], Errors.unknown_func);
    const func: admin_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(admin_func_t)), Errors.wrong_use_function);
  } with (Constants.no_operations, s with record[ storage = func(p, s.storage) ])