function connect_strategy(
  const conn_param      : conn_strategy_param;
  var s                 : storage_t)
                        : return_t is
 block {
  const dev_address = get_dev_address(s);
  require(Tezos.sender = dev_address, Errors.Dex.not_developer);
  var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
  function claim_reserves(
    const token_id: pool_token_id_t;
    const config  : strategy_storage_t)
                  : unit is
      block {
        if config.strategy_reserves > 0n
          then skip// TODO: claim tokens back
      } with unit;
  Map.iter(claim_reserves, pool.strategy.configuration);
  pool.strategy.strat_contract := params.strategy_contract;
  pool.strategy.configuration := (map[]: map(pool_token_id_t, strategy_storage_t));
  s.pools[params.pool_id] := pool;
 } with (Constants.no_operations, s)

function update_token_to_strategy_params(
  const conn_t_param    : conn_tok_strat_param;
  var s                 : storage_t)
                        : return_t is
 block {
  const dev_address = get_dev_address(s);
  require(Tezos.sender = dev_address, Errors.Dex.not_developer);
  var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
  var strat_config = pool.strategy.configuration;
  strat_config[params.pool_token_id] := case Map.find_opt(params.pool_token_id, strat_config) of [
      Some(data) -> {
        // TODO: reinvest with new params?
      } with data with record [
          des_reserves_rate_f = params.des_reserves_rate_f;
          delta_rate_f        = params.delta_rate_f;
          min_invest          = params.min_invest;
      ]
    | None -> {
      // TODO: update lending_market_id on strategy call
    } with record[
      des_reserves_rate_f = params.des_reserves_rate_f;
      delta_rate_f        = params.delta_rate_f;
      min_invest          = params.min_invest;
      strategy_reserves   = 0n;
    ]
  ]
  s.pools[params.pool_id] := pool;
 } with (Constants.no_operations, s)