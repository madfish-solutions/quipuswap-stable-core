function add_liq(
    const params  : record[
                      referral: option(address);
                      pair_id :nat;
                      pair    : pair_type;
                      inputs  : map(nat, nat);
                      min_mint_amount: nat;
                    ];
    const s       : storage_type
  ): return_type is
  block {
    var operations: list(operation) := no_operations;
    var pair : pair_type := params.pair;
    const tokens_count = get_token_count(pair);
    const amp = _A(pair);
    const init_reserves = pair.virtual_reserves;
    // Initial invariant
    const d0 = _get_D_mem(init_reserves, amp, pair);
    var token_supply := pair.total_supply;
    function add_inputs (const key : token_pool_index; const value : nat) : nat is
      block {
        const input = case params.inputs[key] of
            Some(res) -> res
          | None -> 0n
          end;
        const new_reserve = value + input;
      } with new_reserve;
    var _new_reserves := Map.map(add_inputs, init_reserves);

    const d1 = _get_D_mem(_new_reserves, amp, pair);

    assert(d1 > d0);
    var mint_amount := 0n;
    var new_storage: storage_type := s;
    if token_supply > 0n
      then {
        // Only account for fees if we are not the first to deposit
        // const fee = sum_all_fee(pair) * tokens_count / (4 * (tokens_count - 1));
        // const wo_lp_fee = sum_wo_lp_fee(pair) * tokens_count / (4 * (tokens_count - 1));
        var _d2 := d1;
        for _i := 0 to int(tokens_count)
          block {
            const i = case is_nat(_i) of
                Some(i) -> i
              | None -> (failwith("below zero"): nat)
              end;
            const old_balance = case init_reserves[i] of
                            Some(bal) -> bal
                          | None -> (failwith("No such reserve"): nat)
                          end;
            const new_balance = case _new_reserves[i] of
                            Some(bal) -> bal
                          | None -> (failwith("No such reserve"): nat)
                          end;

            const ideal_balance = d1 * old_balance / d0;
            const difference = abs(ideal_balance - new_balance);
            // const fee_norm = fee * difference / FEE_DENOMINATOR;
            const referral: address = case (params.referral: option(address)) of
                Some(ref) -> ref
              | None -> get_default_refer(s)
              end;

            const after_fees = apply_invest_fee(referral, params.pair_id, i, difference, new_balance, new_storage);

            // pair.virtual_reserves[i] := abs(new_balance - (wo_lp_fee / FEE_DENOMINATOR));
            _new_reserves[i] := after_fees.0; // abs(new_balance - fee_norm);
            new_storage := after_fees.1;
          };
        pair := get_pair(params.pair_id, new_storage);
        _d2 := _get_D_mem(_new_reserves, amp, pair);
        mint_amount := token_supply * abs(_d2 - d0) / d0;
      }
    else {
        pair.virtual_reserves := _new_reserves;
        mint_amount := d1;  // Take the dust if there was any
    };
    assert(mint_amount >= params.min_mint_amount); // "Slippage screwed you"

    function transfer_to_pool(const acc : list(operation); const input : nat * nat) : list(operation) is
      typed_transfer(
        Tezos.sender,
        Tezos.self_address,
        input.1,
        get_token_by_id(input.0, params.pair_id, s)
      ) # acc;

    operations := Map.fold(transfer_to_pool, params.inputs, operations);
    new_storage.ledger[(Tezos.sender, params.pair_id)] := mint_amount;
    pair.total_supply := pair.total_supply + mint_amount;
    new_storage.pools[params.pair_id] := pair;
  } with (operations, new_storage)



(* Initialize exchange after the previous liquidity was drained *)
function initialize_exchange(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
      AddPair(params) -> {
        (* Params check *)
        const inp_len = Map.size(params.input_tokens);
        const max_index = abs(params.n_tokens - 1n);
        if (
          (max_index > _C_max_tokens_index)
          or (params.n_tokens < 2n)
          or (inp_len =/= params.n_tokens)
        )
          then failwith(err_wrong_tokens_count);
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
          then failwith(err_wrong_pair_order);
        else
          if max_index > 2n
            then {
              const trd_token = get_asset(2n);
              if trd_token >= snd_token
                then failwith(err_wrong_pair_order);
              else
                if max_index > 3n
                  then {
                    const fth_token = get_asset(3n);
                    if fth_token >= trd_token
                      then failwith(err_wrong_pair_order);
                    else skip;
                  }
                else skip;
            }
          else skip;

        const (pair_i, token_id) = get_pair_info(tokens, s);
        var _pair := pair_i;
        if s.pools_count = token_id
        then {
          s.pool_to_id[Bytes.pack(tokens)] := token_id;
          s.pools_count := s.pools_count + 1n;
        }
        else skip;
        s.tokens[token_id] := tokens;
        _pair.initial_A := params.a_constant;
        _pair.future_A := params.a_constant;
        _pair.initial_A_time := Tezos.now;
        _pair.future_A_time := Tezos.now;

        if _pair.total_supply =/= 0n
        then failwith(err_pair_listed)
        else skip;

        function map_rates_outs(
          const acc   : (map(token_pool_index, nat) * map(token_pool_index, nat));
          const entry : (token_pool_index * input_token)
        )             : (map(token_pool_index, nat) * map(token_pool_index, nat)) is
          (
            Map.add(entry.0, entry.1.rate,      acc.0),
            Map.add(entry.0, entry.1.in_amount, acc.1)
          );

        const (token_rates, inputs) = Map.fold(
          map_rates_outs,
          params.input_tokens,
          (
            (map[]: map(token_pool_index, nat)),
            (map[]: map(token_pool_index, nat))
          )
        );

        _pair.token_rates := token_rates;
        const prms = record[
          referral= (None: option(address));
          pair_id = token_id;
          pair    = _pair;
          inputs  = inputs;
          min_mint_amount = 1n;
        ];
        const res = add_liq(prms, s);
        operations := res.0;
        s := res.1;
      }
    | _                 -> skip
    end
} with (operations, s)

(* Provide liquidity (balanced) to the pool,
note: tokens should be approved before the operation *)
function invest_liquidity(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
    | Invest(params) -> {
        const result = add_liq(record[
          referral= Some(params.referral);
          pair_id = params.pair_id;
          pair    = get_pair(params.pair_id, s);
          inputs  = params.in_amounts;
          min_mint_amount = params.shares;
        ], s);
        operations := result.0;
        s := result.1;
    }
    | _ -> skip
    end
  } with (operations, s)

// (* Intrenal functions for swap hops *)
// function internal_token_to_token_swap(
//   var tmp               : tmp_swap_type;
//   const params          : swap_slice_type)
//                         : tmp_swap_type is
//   block {
//     const pair : pair_type = get_pair(params.pair_id, tmp.s);
//     const tokens : tokens_type = get_tokens(params.pair_id, tmp.s);
//     var swap: swap_data_type :=
//       form_swap_data(pair, tokens, params.operation);

//     if pair.token_a_pool * pair.token_b_pool = 0n
//     then failwith(err_no_liquidity)
//     else skip;
//     if tmp.amount_in = 0n
//     then failwith(err_zero_in)
//     else skip;
//     if swap.from_.token =/= tmp.token_in
//     then failwith(err_wrong_route)
//     else skip;

//     const from_in_with_fee : nat = tmp.amount_in * fee_num;
//     const numerator : nat = from_in_with_fee * swap.to_.pool;
//     const denominator : nat = swap.from_.pool * fee_denom + from_in_with_fee;

//     const out : nat = numerator / denominator;

//     swap.to_.pool := abs(swap.to_.pool - out);
//     swap.from_.pool := swap.from_.pool + tmp.amount_in;

//     tmp.amount_in := out;
//     tmp.token_in := swap.to_.token;

//     const updated_pair : pair_type = form_pools(
//       swap.from_.pool,
//       swap.to_.pool,
//       pair.total_supply,
//       params.operation);
//     tmp.s.pairs[params.pair_id] := updated_pair;

//     tmp.operation := Some(
//       typed_transfer(
//         Tezos.self_address,
//         tmp.receiver,
//         out,
//         swap.to_.token
//       ));
//   } with tmp

// (* Exchange tokens to tokens with multiple hops,
// note: tokens should be approved before the operation *)
// function token_to_token_route(
//   const p               : action_type;
//   var s                 : storage_type)
//                         : return_type is
//   block {
//     var operations: list(operation) := list[];
//     case p of
//       Swap(params) -> {
//         if List.size(params.swaps) < 1n
//         then failwith(err_empty_route)
//         else skip;

//         const first_swap : swap_slice_type =
//           case List.head_opt(params.swaps) of
//             Some(swap) -> swap
//           | None -> failwith(err_empty_route)
//           end;

//         const tokens : tokens_type = get_tokens(first_swap.pair_id, s);
//         const token : token_type =
//           case first_swap.operation of
//             A_to_b -> tokens.token_a_type
//           | B_to_a -> tokens.token_b_type
//         end;

//         operations :=
//           typed_transfer(
//             Tezos.sender,
//             Tezos.self_address,
//             params.amount_in,
//             token
//           ) # operations;

//         const tmp : tmp_swap_type = List.fold(
//           internal_token_to_token_swap,
//           params.swaps,
//           record [
//             s = s;
//             amount_in = params.amount_in;
//             operation = (None : option(operation));
//             receiver = params.receiver;
//             token_in = token;
//           ]
//         );

//         if tmp.amount_in < params.min_amount_out
//         then failwith(err_high_min_out)
//         else skip;

//         s := tmp.s;

//         const last_operation : operation =
//           case tmp.operation of
//             Some(o) -> o
//           | None -> failwith(err_empty_route)
//           end;
//         operations := last_operation # operations;
//       }
//     | _                 -> skip
//     end
//   } with (operations, s)

(* Remove liquidity (balanced) from the pool by burning shares *)
// function divest_liquidity(
//   const p               : action_type;
//   var s                 : storage_type)
//                         : return_type is
//   block {
//     var operations: list(operation) := no_operations;
//     case p of
//       Divest(params) -> {
//         var pair : pair_type := get_pair(params.pair_id, s);
//         const tokens : tokens_type = get_tokens(params.pair_id, s);

//         if s.pairs_count = params.pair_id
//         then failwith(err_pair_not_listed)
//         else skip;
//         if pair.token_a_pool * pair.token_b_pool = 0n
//         then failwith(err_no_liquidity)
//         else skip;

//         var account : account_info := get_account((Tezos.sender, params.pair_id), s);
//         const share : nat = account.balance;

//         if params.shares > share
//         then failwith(err_insufficient_lp)
//         else skip;

//         account.balance := abs(share - params.shares);
//         s.ledger[(Tezos.sender, params.pair_id)] := account;

//         const token_a_divested : nat =
//           pair.token_a_pool * params.shares / pair.total_supply;
//         const token_b_divested : nat =
//           pair.token_b_pool * params.shares / pair.total_supply;

//         if params.min_token_a_out = 0n or params.min_token_b_out = 0n
//         then failwith(err_dust_out)
//         else skip;

//         if token_a_divested < params.min_token_a_out
//         or token_b_divested < params.min_token_b_out
//         then failwith(err_high_min_out)
//         else skip;

//         pair.total_supply := abs(pair.total_supply - params.shares);
//         pair.token_a_pool := abs(pair.token_a_pool - token_a_divested);
//         pair.token_b_pool := abs(pair.token_b_pool - token_b_divested);

//         s.pairs[params.pair_id] := pair;

//         operations :=
//           typed_transfer(
//             Tezos.self_address,
//             Tezos.sender,
//             token_a_divested,
//             tokens.token_a_type
//           ) # operations;
//         operations :=
//           typed_transfer(
//             Tezos.self_address,
//             Tezos.sender,
//             token_b_divested,
//             tokens.token_b_type
//           ) # operations;
//       }
//     | _                 -> skip
//     end
//   } with (operations, s)

(* DEX admin methods *)

(* Remove liquidity (balanced) from the pool by burning shares *)
function ramp_A(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
    | RampA(params) -> {
        is_admin(s);
        var pair : pair_type := get_pair(params.pair_id, s);
        const current = Tezos.now;
        assert(current >= pair.initial_A_time + _C_min_ramp_time);
        assert(params.future_time >= current + _C_min_ramp_time); //  # dev: insufficient time

        const initial_A: nat = _A(pair);
        const future_A_p: nat = params.future_A * _C_a_precision;

        assert((params.future_A > 0n) and (params.future_A < _C_max_a));
        if future_A_p < initial_A
          then assert(future_A_p * _C_max_a_change >= initial_A)
        else assert(future_A_p <= initial_A * _C_max_a_change);

        pair.initial_A := initial_A;
        pair.future_A := future_A_p;
        pair.initial_A_time := current;
        pair.future_A_time := params.future_time;
        s.pools[params.pair_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

function stop_ramp_A(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
    | StopRampA(pair_id) -> {
      is_admin(s);
      var pair : pair_type := get_pair(pair_id, s);
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

function set_proxy(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
    | SetProxy(params) -> {
      is_admin(s);
      var pair : pair_type := get_pair(params.pair_id, s);
      // TODO: all the rewards must be claimed from the contract before in the same call
      pair.proxy_contract := params.proxy;
      s.pools[params.pair_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

function update_proxy_limits(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
    | UpdateProxyLimits(params) -> {
      is_admin(s);
      var pair : pair_type := get_pair(params.pair_id, s);
      pair.proxy_limits := params.limits;
      s.pools[params.pair_id] := pair;
      (* TODO: claim rewards and old staked values *)
      }
    | _ -> skip
    end
  } with (operations, s)

// function claim_admin_rewards(
//   const p               : action_type;
//   var s                 : storage_type)
//                         : return_type is
//   block {
//     var operations: list(operation) := no_operations;
//     case p of
//     | ClaimAdminRewards(params) -> {
//       is_admin(s);
//       var pair : pair_type := get_pair(params.pair_id, s);
//       // TODO: transfer admin rewards to dev address
//       s.pairs[pair_id] := pair;
//       }
//     | _ -> skip
//     end
//   } with (operations, s)



