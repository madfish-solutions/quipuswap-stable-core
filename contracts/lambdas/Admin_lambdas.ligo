function add_rem_managers(const p: admin_action_t; var s: storage_t): storage_t is case p of
  | AddRemManagers(params) -> s with record [managers = Set.update(params.candidate, params.add, s.managers)]
  | _ -> s
  end

function set_dev_address(const p: admin_action_t; var s: storage_t): storage_t is case p of
  | SetDevAddress(new_dev) -> s with record [dev_address = new_dev]
  | _ -> s
  end

function set_reward_rate(const p: admin_action_t; var s: storage_t): storage_t is case p of
  | SetRewardRate(rate) -> if (rate <= CONSTANTS.rate_precision)
      then s with record [reward_rate = rate]
    else failwith(ERRORS.wrong_precision)
  | _ -> s
  end

function set_admin(const p: admin_action_t; var s: storage_t): storage_t is case p of
  | SetAdmin(new_admin) -> s with record [admin = new_admin]
  | _ -> s
  end
