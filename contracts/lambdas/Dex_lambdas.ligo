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

(* Custom *)

(* Divest imbalanced *)
function divest_imbalanced(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | DivestImbalanced(params) -> {
        const receiver = Tezos.sender;
        const share         : nat = get_account_balance((Tezos.sender, params.pair_id), s.ledger);
        if params.max_shares = 0n
          then failwith(ERRORS.zero_in)
        else skip;
        var pair := get_pair(params.pair_id, s.pools);
        const fees = pair.fee;
        const tokens = get_tokens(params.pair_id, s.tokens);
        const amp = _A(pair);
        const init_reserves = pair.virtual_reserves;
        const tokens_count = Map.size(pair.virtual_reserves);
        // Initial invariant
        const d0 = _get_D_mem(init_reserves, amp, pair);
        var token_supply := pair.total_supply;
        function min_inputs (const key : token_pool_index; const value : nat) : nat is
          case params.amounts_out[key] of
                Some(res) -> nat_or_error(value - res, "Not enough reserves")
              | None -> value
              end;
        var new_reserves := Map.map(min_inputs, init_reserves);

        const d1 = _get_D_mem(new_reserves, amp, pair);

        [@inline]
        function divide_fee_for_balance(const fee: nat): nat is fee * tokens_count / (4n * nat_or_error(tokens_count - 1, "invalid tokens count"));

        function balance_this_divest(
          var acc     : record[
            new_reserves : map(token_pool_index, nat);
            new_balances : map(token_pool_index, nat);
            stkr         : staker_acc_type;
            dev          : map(token_type, nat)
          ];
          const entry : token_pool_index * nat
          )           : record [
            new_reserves : map(token_pool_index, nat);
            new_balances : map(token_pool_index, nat);
            stkr         : staker_acc_type;
            dev          : map(token_type, nat)
          ] is
        block {
          const new_bal = entry.1;
          const old_bal = case init_reserves[entry.0] of
            | Some(res) -> res
            | None -> (failwith("Not such init reserve"): nat)
            end;
          const ideal_bal = d1 * old_bal / d0;
          const diff = abs(ideal_bal - new_bal); // |ideal_bal - new_bal|
          const to_dev = diff * divide_fee_for_balance(fees.dev_fee) / CONSTANTS.fee_denominator;
          var to_lp := diff * divide_fee_for_balance(fees.lp_fee) / CONSTANTS.fee_denominator;
          var to_stkr := 0n;
          if acc.stkr.total_staked =/= 0n
            then to_stkr := diff * divide_fee_for_balance(fees.stakers_fee) / CONSTANTS.fee_denominator
          else to_lp := to_lp + diff * divide_fee_for_balance(fees.stakers_fee) / CONSTANTS.fee_denominator;
          const token = get_token_by_id(entry.0, Some(tokens));
          acc.dev[token] := case acc.dev[token] of
              Some(dev) -> dev + to_dev
            | None -> to_dev
          end;
          if to_stkr > 0n
          then acc.stkr.accumulator[entry.0] := case acc.stkr.accumulator[entry.0] of
            | Some(rew) -> rew + to_stkr * CONSTANTS.stkr_acc_precision / acc.stkr.total_staked
            | None -> to_stkr * CONSTANTS.stkr_acc_precision / acc.stkr.total_staked
            end;
          else skip;
          acc.new_reserves[entry.0] := nat_or_error(new_bal - to_stkr - to_dev, "Not enough balance");
          acc.new_balances[entry.0] := nat_or_error(new_bal - to_stkr - to_lp - to_dev, "Not enough balance");
        } with acc;
        const result = Map.fold(balance_this_divest, new_reserves, record [
          new_reserves = (map []: map(token_pool_index, nat));
          new_balances = (map []: map(token_pool_index, nat));
          stkr = pair.staker_accumulator;
          dev = (map []: map(token_type, nat));
        ]);
        pair.staker_accumulator := result.stkr;
        function dev_iterated (var acc: big_map(token_type, nat); const i : token_type * nat) : big_map(token_type, nat) is
        block{
          acc[i.0] := case acc[i.0] of
          | Some(dev) -> i.1 + dev
          | None -> i.1
          end;
        } with acc;
        s.dev_rewards := Map.fold(dev_iterated, result.dev, s.dev_rewards);
        const d2 = _get_D_mem(result.new_balances, amp, pair);
        new_reserves := result.new_reserves;
        var burn_amount := nat_or_error(d0-d2, "d2>d0") * token_supply / d0;
        if burn_amount = 0n
          then failwith(ERRORS.zero_burn_amount)
        else skip;
        burn_amount := burn_amount + 1n; // In case of rounding errors - make it unfavorable for the "attacker"
        if burn_amount <= params.max_shares
          then failwith(ERRORS.insufficient_lp)
        else skip;
        const new_shares = nat_or_error(share - burn_amount, ERRORS.insufficient_lp);
        function add_ops(
          const acc     : list(operation);
          const entry : token_pool_index * nat
          )           : list(operation) is
            typed_transfer(
              Tezos.self_address,
              receiver,
              entry.1,
              get_token_by_id(entry.0, Some(tokens))
            ) # acc;
        pair := set_reserves_from_diff(init_reserves, new_reserves, pair);
        pair.total_supply := nat_or_error(pair.total_supply - burn_amount, "total_supply<burn_amount");
        s.pools[params.pair_id] := pair;
        s.ledger[(receiver, params.pair_id)] := new_shares;
        operations := Map.fold(add_ops, params.amounts_out, operations)
    }
    | _ -> skip
    end;
  } with (operations, s)

(* Divest one coin *)
function divest_one_coin(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | DivestOneCoin(_params) -> skip
    | _ -> skip
    end;
  } with (operations, s)

(* DEX admin methods *)

(* 10n ramping A constant *)
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

(* 11n stop ramping A constant *)
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

(* 12n set or remove proxy *)
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

(* 13n updates limits percent for proxy *)
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

(* 14n updates fees percents *)
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

(* Claimers of rewards *)

(* 6n Developer *)
function claim_dev(
  const p : action_type;
  var s   : storage_type
  )       : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    const receiver = s.dev_address;
    case p of
      | ClaimDeveloper(params) -> {
        is_admin_or_dev(s.admin, s.dev_address);
        const bal = case s.dev_rewards[params.token] of
        | Some(bals) -> bals
        | None -> 0n
        end;
        s.dev_rewards[params.token] := nat_or_error(bal-params.amount, "Amount greater than balance");
        if params.amount > 0n
          then {
            operations := typed_transfer(
              Tezos.self_address,
              receiver,
              params.amount,
              params.token
            ) # operations;
          }
        else failwith("Amount is 0")
      }
      | _ -> skip
      end;
  } with (operations, s)

(* 7n Referral *)
function claim_ref(
  const p : action_type;
  var s   : storage_type
  )       : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    const receiver = Tezos.sender;
    case p of
      | ClaimReferral(params) -> {
        const key = (receiver, params.token);
        const bal = case s.referral_rewards[key] of
          | Some(bals) -> bals
          | None -> (failwith("ref not found"): nat)
          end;
        s.referral_rewards[key] := nat_or_error(bal-params.amount, "Amount greater than balance");
        if params.amount > 0n
          then {
            operations := typed_transfer(
              Tezos.self_address,
              receiver,
              params.amount,
              params.token
            ) # operations;
          }
        else failwith("Amount is 0")
      }
      | _ -> skip
    end;
  } with (operations, s)

(* 8n QuipuToken Stakers *)
function claim_staker(
  const p : action_type;
  var s   : storage_type
  )       : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    const receiver = Tezos.sender;
    case p of
      | ClaimStaking(params) -> {
          const staker_key = (receiver, params.pool_id);
          var staker_acc := get_staker_acc(staker_key, s.stakers_balance);
          var staker_rew_data: acc_reward_type := case staker_acc.earnings[params.token_index] of
          | Some(data) -> data
          | None -> record [
            reward  = 0n;
            former  = 0n;
          ]
          end;
          const bal = staker_rew_data.reward;
          const new_balance = nat_or_error(bal - params.amount, "Amount greater than balance");
          if params.amount > 0n
            then {
              operations := typed_transfer(
                Tezos.self_address,
                receiver,
                params.amount,
                get_token_by_id(params.token_index, s.tokens[params.pool_id])
              ) # operations;
              staker_rew_data.former := 0n;
              staker_rew_data.reward := new_balance;
            }
          else failwith("Balance is 0");
          staker_acc.earnings[params.token_index] := staker_rew_data;
          s.stakers_balance[staker_key] := staker_acc;
        }
        | _ -> skip
        end;
  } with (operations, s)

(* 9n LP providers *)
function claim_provider(
  const p : action_type;
  var s   : storage_type
  )       : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    const receiver = Tezos.sender;
    case p of
      | ClaimLProvider(params) -> {
        const acc_key = (receiver, params.pool_id);
        var acc_data := get_account_data(acc_key, s.account_data);
        var acc_intrst_data: acc_reward_type := case acc_data.earned_interest[params.token] of
          | Some(data) -> data
          | None -> record [
            reward  = 0n;
            former  = 0n;
          ]
          end;
        const bal = acc_intrst_data.reward;
        const new_balance = nat_or_error(bal - params.amount, "Amount greater than balance");
        if params.amount > 0n
          then {
            operations := typed_transfer(
              Tezos.self_address,
              receiver,
              params.amount,
              params.token
            ) # operations;
            acc_intrst_data.former := 0n;
            acc_intrst_data.reward := new_balance;
          }
        else failwith("Balance is 0");
        acc_data.earned_interest[params.token] := acc_intrst_data;
        s.account_data[acc_key] := acc_data;
      }
      | _ -> skip
    end;
  } with (operations, s)