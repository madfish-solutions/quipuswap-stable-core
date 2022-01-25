function permit(
  const p               : permit_action_t;
  var s                 : full_storage_t)
                        : full_storage_t is
  block {
    case p of
    | Permit(param) -> {
      const key : key = param.0;
      const signature : signature = param.1.0;
      const permit : blake2b_hash_t = param.1.1;
      const issuer: address = Tezos.address(Tezos.implicit_account(Crypto.hash_key(key)));
      const to_sign : bytes = Bytes.pack(((Tezos.self_address, Tezos.chain_id),(s.permits_counter, permit)));
      s := if Crypto.check(key, signature, to_sign)
        then s with record [
          permits_counter = s.permits_counter + 1n;
          permits = delete_expired_permits(
            s.default_expiry,
            issuer,
            insert_permit(s.default_expiry, issuer, permit, s.permits)
          );
        ]
      else block {
        const failwith_ : (string * bytes -> full_storage_t) = [%Michelson ({|{FAILWITH}|} : string * bytes -> full_storage_t)];
      } with (failwith_(Errors.Permit.missigned, to_sign) : full_storage_t);
    }
    | _ -> skip
    end
  } with s

function set_expiry(
  const p               : permit_action_t;
  var s                 : full_storage_t)
                        : full_storage_t is
  block {
    case p of
    | Set_expiry(param) -> {
      const owner : address = param.issuer;
      const new_expiry : seconds_t = param.expiry;
      const specific_permit_or_default : option(blake2b_hash_t) = param.permit_hash;

      // s := sender_check(owner, s, token_param, Errors.Permit.not_issuer);
      assert(Tezos.sender = owner);

      const updated_permits : permits_t = case specific_permit_or_default of
      | None       -> set_user_default_expiry(owner, new_expiry, s.permits)
      | Some(hash) -> set_permit_expiry(owner, hash, new_expiry, s.permits, s.default_expiry)
      end;

      s.permits := updated_permits;
    }
    | _ -> skip
    end;
  } with s
