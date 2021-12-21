type set_man_prm_t is [@layout:comb] record [
  add                     : bool;
  candidate               : address;
]

type admin_action_t is
| Add_rem_managers          of set_man_prm_t (* adds a manager to manage LP token metadata *)
| Set_dev_address           of address
| Set_admin                 of address
