(* 0n Initialize exchange after the previous liquidity was drained *)
function initialize_exchange(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | AddPair(params) -> {
      is_admin(s.admin);
      (* Params check *)
      const inp_len = Map.size(params.input_tokens);
      const max_index = nat_or_error(params.n_tokens - 1n, "tokens_less_1n");
      if (
        (max_index > CONSTANTS.max_tokens_index)
        or (params.n_tokens < 2n)
        or (inp_len =/= params.n_tokens)
      )
        then failwith(ERRORS.wrong_tokens_count);
      else skip;

      function get_tokens_from_param(
        const _key   : nat;
        const value : input_token): token_type is
        value.asset;

      const tokens: tokens_type = Map.map(get_tokens_from_param, params.input_tokens);

      (* Params ordering check *)

      function get_asset(const key: nat): token_type is
        case tokens[key] of
          Some(input) -> input
        | None -> (failwith("Unable to locate token"): token_type)
        end;

      const fst_token = get_asset(0n);
      const snd_token = get_asset(1n);

      if snd_token >= fst_token
        then failwith(ERRORS.wrong_pair_order);
      else
        if max_index > 2n
          then {
            const trd_token = get_asset(2n);
            if trd_token >= snd_token
              then failwith(ERRORS.wrong_pair_order);
            else
              if max_index > 3n
                then {
                  const fth_token = get_asset(3n);
                  if fth_token >= trd_token
                    then failwith(ERRORS.wrong_pair_order);
                  else skip;
                }
              else skip;
          }
        else skip;

      const (pair_i, token_id) = get_pair_info(tokens, s);

      if s.pools_count = token_id
      then {
        s.pool_to_id[Bytes.pack(tokens)] := token_id;
        s.pools_count := s.pools_count + 1n;
      }
      else skip;

      s.tokens[token_id] := tokens;

      function map_rates_outs_zeros(
        const acc   : (
          map(token_pool_index, nat) *
          map(token_pool_index, nat) *
          map(token_pool_index, nat) *
          map(token_pool_index, nat)
        );
        const entry : (token_pool_index * input_token)
      )             : (
          map(token_pool_index, nat) *
          map(token_pool_index, nat) *
          map(token_pool_index, nat) *
          map(token_pool_index, nat)
        ) is (
          Map.add(entry.0, entry.1.rate,                      acc.0),
          Map.add(entry.0, entry.1.precision_multiplier,      acc.1),
          Map.add(entry.0, entry.1.in_amount,                 acc.2),
          Map.add(entry.0, 0n,                                acc.3)
        );

      const (token_rates, precision_multipliers, inputs, zeros) = Map.fold(
        map_rates_outs_zeros,
        params.input_tokens,
        (
          (map[]: map(token_pool_index, nat)),
          (map[]: map(token_pool_index, nat)),
          (map[]: map(token_pool_index, nat)),
          (map[]: map(token_pool_index, nat))
        )
      );

      if pair_i.total_supply =/= 0n
      then failwith(ERRORS.pair_listed)
      else skip;

      var new_pair: pair_type := pair_i;
      if CONSTANTS.max_a < params.a_constant
      then failwith("A const limit")
      else skip;
      new_pair.initial_A := params.a_constant;
      new_pair.future_A := params.a_constant;
      new_pair.initial_A_time := Tezos.now;
      new_pair.future_A_time := Tezos.now;
      new_pair.token_rates := token_rates;
      new_pair.precision_multipliers := precision_multipliers;
      new_pair.reserves := zeros;
      new_pair.virtual_reserves := zeros;
      new_pair.proxy_limits := zeros;

      const res = add_liq(record [
        referral= (None: option(address));
        pair_id = token_id;
        pair    = new_pair;
        inputs  = inputs;
        min_mint_amount = 1n;
      ], s);

      operations := res.0;
      s := res.1;
    }
    | _                 -> skip
    end
  } with (operations, s)

(* 1n Swap tokens *)
function swap(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | Swap(params) -> {
        const i = params.idx_from;
        const dx = params.amount;
        const j = params.idx_to;
        const min_y = params.min_amount_out;
        // const referral: address = case (params.referral: option(address)) of
        //   | Some(ref) -> ref
        //   | None -> get_default_refer(s)
        //   end;

        if dx = 0n
          then failwith(ERRORS.zero_in)
        else skip;

        var pair : pair_type := get_pair(params.pair_id, s.pools);
        const tokens : tokens_type = get_tokens(params.pair_id, s.tokens);
        const tokens_count = Map.size(tokens);

        if i >= tokens_count or j >= tokens_count
          then failwith("Wrong index")
        else skip;

        const token_i = case tokens[i] of
          | Some(token) -> token
          | None -> (failwith("no such T index") : token_type)
          end;
        const token_j = case tokens[j] of
          | Some(token) -> token
          | None -> (failwith("no such T index") : token_type)
          end;
        const old_reserves_i = case pair.reserves[i] of
          | Some(value) -> value
          | None -> (failwith("no such R index") : nat)
          end;
        const old_virt_reserves_i = case pair.virtual_reserves[i] of
          | Some(value) -> value
          | None -> (failwith("no such R index") : nat)
          end;
        const old_reserves_j = case pair.reserves[j] of
          | Some(value) -> value
          | None -> (failwith("no such R index") : nat)
          end;
        const old_virt_reserves_j = case pair.virtual_reserves[j] of
          | Some(value) -> value
          | None -> (failwith("no such R index") : nat)
          end;


        var dy := preform_swap(i, j, dx, pair);
        // TODO: perform fee separation
        const after_fees = perform_fee_slice(dy, pair);
        dy := after_fees.0;
        const to_ref = after_fees.1;
        const to_dev = after_fees.2;
        const to_stakers = after_fees.3;

        const referral: address = case (params.referral: option(address)) of
          | Some(ref) -> ref
          | None -> get_default_refer(s)
          end;
        s.referral_rewards[(referral, token_j)] := case s.referral_rewards[(referral, token_j)] of
          | Some(rew) -> rew + to_ref
          | None -> to_ref
        end;
        s.dev_rewards[token_j] := case s.dev_rewards[token_j] of
          | Some(rew) -> rew + to_dev
          | None -> to_dev
        end;
        if to_stakers > 0n
         then pair.staker_accumulator.accumulator[j] := case pair.staker_accumulator.accumulator[j] of
          | Some(rew) -> rew + to_stakers * CONSTANTS.stkr_acc_precision / pair.staker_accumulator.total_staked
          | None -> to_stakers * CONSTANTS.stkr_acc_precision / pair.staker_accumulator.total_staked
          end;
        else skip;

        if dy < min_y
          then failwith(ERRORS.high_min_out)
        else skip;

        pair.virtual_reserves[i] := old_virt_reserves_i + dx;
        pair.reserves[i] := old_reserves_i + dx;
        pair.virtual_reserves[j] := nat_or_error(old_virt_reserves_j - dy, "dy>reserves");
        pair.reserves[j] := nat_or_error(old_reserves_j - dy, "dy>reserves");

        s.pools[params.pair_id] := pair;

        const receiver = case params.receiver of
          | Some(receiver) -> receiver
          | None -> Tezos.sender
          end;

        operations := typed_transfer(
          Tezos.self_address,
          receiver,
          dy,
          token_j
        ) # operations;

        operations := typed_transfer(
          Tezos.sender,
          Tezos.self_address,
          dx,
          token_i
        ) # operations;

    }
    | _ -> skip
    end
  } with (operations, s)

(* 2n Provide liquidity (balanced) to the pool,
note: tokens should be approved before the operation *)
function invest_liquidity(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | Invest(params) -> {
        const referral: address = case (params.referral: option(address)) of
          | Some(ref) -> ref
          | None -> get_default_refer(s)
          end;
        const result = add_liq(record[
          referral= Some(referral);
          pair_id = params.pair_id;
          pair    = get_pair(params.pair_id, s.pools);
          inputs  = params.in_amounts;
          min_mint_amount = params.shares;
        ], s);
        operations := result.0;
        s := result.1;
    }
    | _ -> skip
    end
  } with (operations, s)


(* 3n Remove liquidity (balanced) from the pool by burning shares *)
function divest_liquidity(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | Divest(params) -> {

        if s.pools_count <= params.pair_id
          then failwith(ERRORS.pair_not_listed)
        else skip;

        var   pair          : pair_type := get_pair(params.pair_id, s.pools);
        const tokens        : tokens_type = get_tokens(params.pair_id, s.tokens);
        const share         : nat = get_account_balance((Tezos.sender, params.pair_id), s.ledger);
        const total_supply  : nat = pair.total_supply;
        if params.shares = 0n
         then failwith(ERRORS.zero_in)
        else skip;
        const new_shares = nat_or_error(share - params.shares, ERRORS.insufficient_lp);
        const init_virt_reserves = pair.virtual_reserves;
        const init_reserves = pair.reserves;

        function divest_reserves(
          var acc: (
            map(token_pool_index, nat) *
            list(operation)
          );
          const entry: (token_pool_index * token_type)
        ) : (
            map(token_pool_index, nat) *
            list(operation)
          ) is
          block {
            const old_balance = case init_virt_reserves[entry.0] of
              | Some(reserve) -> reserve
              | None -> 0n
              end;
            const min_amount_out = case params.min_amounts_out[entry.0] of
              | Some(min) -> min
              | None -> 1n
              end;
            const token = case tokens[entry.0] of
              | Some(token) -> token
              | None -> (failwith("wrong token index"): token_type)
              end;

            const value = old_balance * params.shares / total_supply;
            const init_res = case init_reserves[entry.0] of
              | Some(res) -> res
              | None -> (failwith("wrong res index"): nat)
              end;

            const new_res = nat_or_error(old_balance - value, "value>virt_reserves");

            if value < min_amount_out
              then failwith(ERRORS.high_min_out);
            else if value = 0n
              then failwith(ERRORS.dust_out)
            else if value > init_res
              then skip; //TODO: add request to proxy;
            else skip;

            acc.0[entry.0] := new_res;
            acc.1 := typed_transfer(
              Tezos.sender,
              Tezos.self_address,
              value,
              token
            ) # acc.1;

          } with acc;
        const res = Map.fold(divest_reserves, tokens, (init_reserves, operations));
        pair := set_reserves_from_diff(init_reserves, res.0, pair);
        pair.total_supply := nat_or_error(pair.total_supply - params.shares, "total_supply<shares");
        s.ledger[(Tezos.sender, params.pair_id)] := new_shares;
        s.pools[params.pair_id] := pair;

        operations := res.1;
      }
    | _                 -> skip
    end
  } with (operations, s)

(* DEX admin methods *)

(* 7n ramping A constant *)
function ramp_A(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | RampA(params) -> {
        is_admin(s.admin);
        var pair : pair_type := get_pair(params.pair_id, s.pools);
        const current = Tezos.now;
        assert(current >= pair.initial_A_time + CONSTANTS.min_ramp_time);
        assert(params.future_time >= current + CONSTANTS.min_ramp_time); //  # dev: insufficient time

        const initial_A: nat = _A(pair);
        const future_A_p: nat = params.future_A * CONSTANTS.a_precision;

        assert((params.future_A > 0n) and (params.future_A < CONSTANTS.max_a));
        if future_A_p < initial_A
          then assert(future_A_p * CONSTANTS.max_a_change >= initial_A)
        else assert(future_A_p <= initial_A * CONSTANTS.max_a_change);

        pair.initial_A := initial_A;
        pair.future_A := future_A_p;
        pair.initial_A_time := current;
        pair.future_A_time := params.future_time;
        s.pools[params.pair_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

(* 8n stop ramping A constant *)
function stop_ramp_A(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | StopRampA(pair_id) -> {
      is_admin(s.admin);
      var pair : pair_type := get_pair(pair_id, s.pools);
      const current = Tezos.now;
      const current_A: nat = _A(pair);
      pair.initial_A := current_A;
      pair.future_A := current_A;
      pair.initial_A_time := current;
      pair.future_A_time := current;
      s.pools[pair_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

(* 9n set or remove proxy *)
function set_proxy(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | SetProxy(params) -> {
      is_admin(s.admin);
      var pair : pair_type := get_pair(params.pair_id, s.pools);
      // TODO: all the rewards must be claimed from the contract before in the same call
      pair.proxy_contract := params.proxy;
      s.pools[params.pair_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

(* 10n updates limits percent for proxy *)
function update_proxy_limits(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | UpdateProxyLimits(params) -> {
      is_admin(s.admin);
      var pair : pair_type := get_pair(params.pair_id, s.pools);
      pair.proxy_limits := params.limits;
      s.pools[params.pair_id] := pair;
      (* TODO: claim rewards and old staked values *)
      }
    | _ -> skip
    end
  } with (operations, s)

(* 11n updates fees percents *)
function set_fees(
  const p               : action_type;
  var s                 : storage_type
  )                     : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | SetFees(params) -> {
      is_admin(s.admin);
      var pair := get_pair(params.pool_id, s.pools);
      pair.fee := params.fee;
      s.pools[params.pool_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

function claim_variant(
  const acc: return_type;
  const claim_action: claim_actions
  ): return_type is
  block {
    var operations: list(operation) := acc.0;
    var s: storage_type := acc.1;
    case claim_action of
        | Developer(params) -> {
            is_admin_or_dev(s.admin, s.dev_address);
            const dev_balance = case s.dev_rewards[params.token] of
            | Some(bal) -> bal
            | None -> 0n
            end;
            if dev_balance > 0n
              then {
                operations := typed_transfer(
                  Tezos.self_address,
                  s.dev_address,
                  params.amount,
                  params.token
                ) # operations;
                s.dev_rewards[params.token] := nat_or_error(dev_balance-params.amount, "Amount greater than balance");
              }
            else failwith("Balance is 0")
          }
        | Referral(params) -> {
            const ref_balance = case s.referral_rewards[(Tezos.sender, params.token)] of
            | Some(bal) -> bal
            | None -> 0n
            end;
            if ref_balance > 0n
              then {
                operations := typed_transfer(
                  Tezos.self_address,
                  Tezos.sender,
                  params.amount,
                  params.token
                ) # operations;
                s.referral_rewards[(Tezos.sender, params.token)] := nat_or_error(ref_balance-params.amount, "Amount greater than balance");
            }
            else failwith("Balance is 0");
          }
        | Staking(params) -> {
            const staker_key = (Tezos.sender, params.pool_id);
            var staker_acc := get_staker_acc(staker_key, s.stakers_balance);
            var staker_rew_data: acc_reward_type := case staker_acc.earnings[params.token_index] of
            | Some(data) -> data
            | None -> record [
              reward  = 0n;
              former  = 0n;
            ]
            end;
            const staker_rew_balance = staker_rew_data.reward;
            if staker_rew_balance > 0n
              then {
                operations := typed_transfer(
                  Tezos.self_address,
                  Tezos.sender,
                  params.amount,
                  get_token_by_id(params.token_index, s.tokens[params.pool_id])
                ) # operations;
                staker_rew_data.reward := nat_or_error(staker_rew_balance - params.amount, "Amount greater than balance");
                staker_rew_data.former := 0n;
              }
            else failwith("Balance is 0");
            staker_acc.earnings[params.token_index] := staker_rew_data;
            s.stakers_balance[staker_key] := staker_acc;
          }
        | LProvider(params) -> {
            const acc_key = (Tezos.sender, params.pool_id);
            var acc_data := get_account_data(acc_key, s.account_data);
            var acc_intrst_data: acc_reward_type := case acc_data.earned_interest[params.token] of
              | Some(data) -> data
              | None -> record [
                reward  = 0n;
                former  = 0n;
              ]
              end;
            const acc_intrst_balance = acc_intrst_data.reward;
            if acc_intrst_balance > 0n
              then {
                operations := typed_transfer(
                  Tezos.self_address,
                  Tezos.sender,
                  params.amount,
                  params.token
                ) # operations;
                acc_intrst_data.reward := 0n;
                acc_intrst_data.former := 0n;
              }
            else failwith("Balance is 0");
            acc_data.earned_interest[params.token] := acc_intrst_data;
            s.account_data[acc_key] := acc_data;
          }
      end;
  } with (operations, s)

function claim_middle(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  case p of
  | Claim(params) -> List.fold(claim_variant, params, (CONSTANTS.no_operations, s))
  | _ -> (CONSTANTS.no_operations, s)
  end


