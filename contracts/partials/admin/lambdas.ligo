function add_rem_managers(const p: admin_action_t; var s: storage_t): storage_t is case p of
  | Add_rem_managers(params) -> s with record [managers = Set.update(params.candidate, params.add, s.managers)]
  | _ -> s
  end

function set_dev_address(const p: admin_action_t; var s: storage_t): storage_t is case p of
  | Set_dev_address(new_dev) -> s with record [dev_address = new_dev]
  | _ -> s
  end

function set_reward_rate(const p: admin_action_t; var s: storage_t): storage_t is case p of
  | Set_reward_rate(rate) -> if (rate <= Constants.rate_precision)
      then s with record [reward_rate = rate]
    else failwith(Errors.wrong_precision)
  | _ -> s
  end

function set_admin(const p: admin_action_t; var s: storage_t): storage_t is case p of
  | Set_admin(new_admin) -> s with record [admin = new_admin]
  | _ -> s
  end
