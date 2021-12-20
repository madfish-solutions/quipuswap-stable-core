function get_mint_ep(const contract: address): contract(lending_prm_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%mint", contract): option(contract(lending_prm_t))),
    Errors.landing_ep_404
  );

function get_redeem_ep(const contract: address): contract(lending_prm_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%redeem", contract): option(contract(lending_prm_t))),
    Errors.landing_ep_404
  );

function get_upd_intrst_ep(const contract: address): contract(token_id_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%updateInterest", contract): option(contract(token_id_t))),
    Errors.landing_ep_404
  );

function get_price_ep(const proxy: address): contract(get_price_prm_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%getPrice", proxy): option(contract(get_price_prm_t))),
    Errors.landing_ep_404
  );
