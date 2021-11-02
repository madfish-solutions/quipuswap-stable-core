#import "../partials/Constants.ligo" "CONSTANTS"
#include "../interfaces/IMetadataStorage.ligo"

[@inline]
function check_pemission(const s: storage_type): unit is
if not (s.owners contains Tezos.sender)
  then failwith("MetadataStorage/permision-denied")
else Unit

(* Add or remove the admin permissions for address;
 only called by one of the current owners *)
function update_owner(
  const params          : set_owner_type;
  var s                 : storage_type)
                        : return_type is
  block {
    check_pemission(s);
    if params.add
      then s.owners := Set.add(params.owner, s.owners)
    else s.owners := Set.remove(params.owner, s.owners);
  } with (CONSTANTS.no_operations, s)

(* Update the metadata for the token;
only called by one of the current owners *)
function update_metadata(
  const new_metadata    : metadata_type;
  var s                 : storage_type)
                        : return_type is
  block { check_pemission(s); s.metadata := new_metadata; } with (CONSTANTS.no_operations, s)

(* MetadataStorage - Contract to store and upgrade the shares token metadata *)
function main(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  case p of
      Update_owners(params)         -> update_owner(params, s)
    | Update_storage(new_metadata)  -> update_metadata(new_metadata, s)
    | Get_metadata(receiver)        -> (list[transaction(s.metadata, 0tz, receiver)], s)
  end
