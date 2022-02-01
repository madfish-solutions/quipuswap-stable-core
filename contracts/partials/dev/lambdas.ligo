(* Sets dev address *)
function set_dev_address(
  const p               : dev_action_t;
  var s                 : dev_storage_t)
                        : dev_storage_t is
  case p of
  | Set_dev_address(new_dev) -> s with record [dev_address = new_dev]
  | _ -> s
  end

function set_dev_fee(
  const p               : dev_action_t;
  var s                 : dev_storage_t)
                        : dev_storage_t is
  block {
    case p of
    | Set_dev_fee(fee) -> {
      require(fee < Constants.fee_denominator / 2n, Errors.Dex.fee_overflow);
      s.dev_fee := fee;
    }
    | _ -> skip
    end;
  } with s