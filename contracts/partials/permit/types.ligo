type owner_t            is address

type operator_t         is address

type blake2b_hash_t     is bytes

type seconds_t          is nat

type counter_t          is nat

type permit_info_t      is [@layout:comb] record [
  created_at              : timestamp;
  expiry                  : option(seconds_t);
]

type user_permits_t     is [@layout:comb] record [
  permits                 : map(blake2b_hash_t, permit_info_t);
  expiry                  : option(seconds_t);
]

type permits_t          is big_map(address, user_permits_t)

type permit_signature_t is michelson_pair(signature, "", blake2b_hash_t, "permit_hash")

type permit_t           is key * permit_signature_t

type revoke_param_t     is blake2b_hash_t * address

type revoke_params_t    is list(revoke_param_t)

type set_expiry_t       is [@layout:comb] record [
  issuer                  : address;
  expiry                  : seconds_t;
  permit_hash             : option(blake2b_hash_t);
]

type is_tx_operator_t   is [@layout:comb] record [
  owner                   : address;
  approved                : bool;
]

type permit_action_t    is
| Permit                  of permit_t
| Set_expiry              of set_expiry_t

[@inline] const new_user_permits : user_permits_t = record [
  permits = (Map.empty : map(blake2b_hash_t, permit_info_t));
  expiry  = (None : option(seconds_t))
]