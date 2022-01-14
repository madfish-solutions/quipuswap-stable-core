type set_man_prm_t      is [@layout:comb] record [
  add                     : bool;
  candidate               : address;
]

type admin_action_t     is
| Add_rem_managers        of set_man_prm_t
| Set_admin               of address
