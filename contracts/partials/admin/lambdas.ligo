(* Updates manager storage *)
function add_rem_managers(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : storage_t is
  case p of
  | Add_rem_managers(params) -> s with record [ managers = Set.update(params.candidate, params.add, s.managers) ]
  | _ -> s
  end
(* Sets admin of contract *)
function set_admin(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : storage_t is
  case p of
  | Set_admin(new_admin) -> s with record [ admin = new_admin ]
  | _ -> s
  end
