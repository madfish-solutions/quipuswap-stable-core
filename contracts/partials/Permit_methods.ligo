function permit(
  const parameter       : permit_t;
  const store           : full_storage_t)
                        : full_return_t is
  block {
    const operations : list(operation) = CONSTANTS.no_operations;
    const key : key = parameter.0;
    const signature : signature = parameter.1.0;
    const permit : blake2b_hash_t = parameter.1.1;
    const issuer: address = Tezos.address(
      Tezos.implicit_account(Crypto.hash_key(key)));
    const to_sign : bytes =
      Bytes.pack((
        (Tezos.self_address, Tezos.chain_id),
        (store.permits_counter, permit)
      ));
    const store : full_storage_t =
    if (Crypto.check (key, signature, to_sign))
    then store with record[
        permits_counter = store.permits_counter + 1n;
        permits = delete_expired_permits(
          store.default_expiry,
          issuer,
          insert_permit(store.default_expiry, issuer, permit, store.permits))
      ]
    else block {
      const failwith_ : (string * bytes -> full_storage_t) =
        [%Michelson ({| { FAILWITH } |} : string * bytes -> full_storage_t)];
    } with failwith_(("MISSIGNED", to_sign))
  } with (operations, store)



function set_expiry(
  const param           : set_expiry_t;
  const store           : full_storage_t;
  const full_param      : full_action_t)
                        : full_return_t is
  block {
    const operations : list(operation) = CONSTANTS.no_operations;
    const owner : address = param.issuer;
    const new_expiry : seconds_t = param.expiry;
    const specific_permit_or_default : option(blake2b_hash_t) = param.permit_hash;
    const updated_store : full_storage_t =
      sender_check(owner, store, full_param, "NOT_PERMIT_ISSUER");

    const updated_permits : permits_t =
      case specific_permit_or_default of
        None -> set_user_default_expiry(
          owner,
          new_expiry,
          updated_store.permits
        )
      | Some(permit_hash) -> set_permit_expiry(
          owner,
          permit_hash,
          new_expiry,
          updated_store.permits,
          store.default_expiry
        )
      end
  } with (
    operations,
    updated_store with record [permits = updated_permits]
  )