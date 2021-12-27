[@inline] function has_expired(
  const default_expiry  : seconds_t;
  const user_expiry_opt : option(seconds_t);
  const permit_info     : permit_info_t)
                        : bool is
  block {
    const expiry : seconds_t = unwrap_or(permit_info.expiry, unwrap_or(user_expiry_opt, default_expiry));
  } with permit_info.created_at + int(expiry) < Tezos.now

[@inline] function delete_expired_permits(
  const default_expiry  : seconds_t;
  const user            : address;
  const permits         : permits_t)
                        : permits_t is
  case permits[user] of
  | None               -> permits
  | Some(user_permits) -> block {
    [@inline] function delete_expired_permit(
      const permits     : map(blake2b_hash_t, permit_info_t);
      const key_value   : blake2b_hash_t * permit_info_t)
                        : map(blake2b_hash_t, permit_info_t) is
      if has_expired(default_expiry, user_permits.expiry, key_value.1)
      then Map.remove(key_value.0, permits)
      else permits;

    const updated_permits : map(blake2b_hash_t, permit_info_t) = Map.fold(
      delete_expired_permit,
      user_permits.permits,
      user_permits.permits
    );
    const updated_user_permits: user_permits_t = user_permits with record [permits = updated_permits]
  } with Big_map.update(user, Some(updated_user_permits), permits)
  end

function check_duplicates(
  const default_expiry  : seconds_t;
  const user_expiry_opt : option(seconds_t);
  const user_permits    : user_permits_t;
  const permit          : blake2b_hash_t)
                        : unit is
  case user_permits.permits[permit] of
  | None              -> unit
  | Some(permit_info) ->
    if not has_expired(default_expiry, user_expiry_opt, permit_info)
    then failwith(Errors.permit_dupl)
    else unit
  end

function insert_permit(
  const default_expiry  : seconds_t;
  const user            : address;
  const permit          : blake2b_hash_t;
  const permits         : permits_t)
                        : permits_t is
  block {
    const user_permits : user_permits_t = unwrap_or(permits[user], new_user_permits);

    check_duplicates(default_expiry, user_permits.expiry, user_permits, permit);

    const updated_user_permits : user_permits_t = user_permits with record [
      permits = Map.add(
        permit,
        record [
          created_at = Tezos.now;
          expiry     = (None : option(seconds_t));
        ],
        user_permits.permits
      )
    ];
  } with Big_map.update(user, Some(updated_user_permits), permits)

function sender_check(
  const expected_user   : address;
  const s               : full_storage_t;
  const action          : full_action_t;
  const err_message     : string)
                        : full_storage_t is
  if Tezos.sender = expected_user
  then s
  else block {
    const action_hash : blake2b_hash_t = Crypto.blake2b(Bytes.pack(action));
    const user_permits : user_permits_t = unwrap(s.permits[expected_user], err_message);
  } with case user_permits.permits[action_hash] of
    | None              -> (failwith(err_message) : full_storage_t)
    | Some(permit_info) ->
      if has_expired(s.default_expiry, user_permits.expiry, permit_info)
      then (failwith(Errors.permit_expired) : full_storage_t)
      else s with record [
        permits = Big_map.update(
          expected_user,
          Some(
            user_permits with record [
              permits = Map.remove(action_hash, user_permits.permits)
            ]
          ),
          s.permits
        )
      ]
    end

[@inline] function set_user_default_expiry(
  const user            : address;
  const new_expiry      : seconds_t;
  const permits         : permits_t)
                        : permits_t is
  block {
    const user_permits : user_permits_t = unwrap_or(permits[user], new_user_permits);
    const updated_user_permits : user_permits_t = user_permits with record [expiry = Some(new_expiry)];
  } with Big_map.update(user, Some(updated_user_permits), permits)

[@inline] function set_permit_expiry_with_check(
  const permit_info     : permit_info_t;
  const new_expiry      : seconds_t)
                        : option(permit_info_t) is
  block {
    const permit_age: int = Tezos.now - permit_info.created_at;
  } with
    if permit_age >= int(new_expiry)
    then (None : option(permit_info_t))
    else Some(permit_info with record [expiry = Some(new_expiry)])

function set_permit_expiry(
  const user            : address;
  const permit          : blake2b_hash_t;
  const new_expiry      : seconds_t;
  const permits         : permits_t;
  const default_expiry  : seconds_t)
                        : permits_t is
  if new_expiry < Constants.permit_expiry_limit
  then case permits[user] of
  | None               -> permits
  | Some(user_permits) -> case user_permits.permits[permit] of
    | None                -> permits
    | Some(permit_info)   -> block {
      const updated_user_permits : user_permits_t = if has_expired(default_expiry, user_permits.expiry, permit_info)
        then user_permits
        else user_permits with record [
          permits = Map.update(
            permit,
            set_permit_expiry_with_check(permit_info, new_expiry),
            user_permits.permits
          )
        ];
    } with Big_map.update(user, Some(updated_user_permits), permits)
    end
  end
  else (failwith(Errors.expiration_overflow) : permits_t)

function transfer_sender_check(
  const params          : transfer_prm_t;
  const action          : full_action_t;
  const s               : full_storage_t)
                        : full_storage_t is
  block {
    [@inline] function check_operator_for_tx(
      var is_tx_operator: is_tx_operator_t;
      const param       : trsfr_fa2_dst_t)
                        : is_tx_operator_t is
      block {
        const account_data: account_data_t = get_account_data(
          (is_tx_operator.owner, param.token_id),
          s.storage.account_data
        );
        const allowances : set(address) = account_data.allowances;

        is_tx_operator.approved := is_tx_operator.approved and
          (is_tx_operator.owner = Tezos.sender or Set.mem(Tezos.sender, allowances));
      } with is_tx_operator;

    [@inline] function check_operator_for_transfer(
      const approved    : bool;
      const param       : trsfr_fa2_prm_t)
                        : bool is
      block {
        var acc : is_tx_operator_t := record [
          owner    = param.from_;
          approved = True;
        ];
        acc := List.fold(check_operator_for_tx, param.txs, acc);
      } with approved and acc.approved;

    const is_approved_for_all_transfers : bool = List.fold(check_operator_for_transfer, params, True);
  } with
      if is_approved_for_all_transfers
      then s
      else case params of
        | nil -> s
        | first_param # rest -> block {
            const from_ : address = first_param.from_;
            const updated_s : full_storage_t = sender_check(from_, s, action, "FA2_NOT_OPERATOR");

            function check(const param : trsfr_fa2_prm_t): unit is
              assert_with_error(param.from_ = from_, "FA2_NOT_OPERATOR");
            List.iter(check, rest);

          } with updated_s
        end