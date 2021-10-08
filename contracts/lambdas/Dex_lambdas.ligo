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

        (* Params ordering check *)

        function get_asset(const key: nat): token_type is
          case params.input_tokens[key] of
            Some(input) -> input.asset
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

        function get_tokens_from_param(
          const _key   : nat;
          const value : input_tokens): token_type is
          value.asset;

        const tokens: tokens_type = Map.map(get_tokens_from_param, params.input_tokens);
        const res : (pair_type * nat) = get_pair_info(tokens, s);
        var pair : pair_type := res.0;
        pair.initial_A := params.a_constant;
        pair.future_A := params.a_constant;
        pair.initial_A_time := Tezos.now;
        pair.future_A_time := Tezos.now;
        pair.tokens_count := params.n_tokens;
        const token_id : nat = res.1;

        if s.pairs_count = token_id
        then {
          s.token_to_id[Bytes.pack(tokens)] := token_id;
          s.pairs_count := s.pairs_count + 1n;
        }
        else skip;

        // if params.token_a_in < 1n
        // then failwith(err_zero_a_in)
        // else skip;
        // if params.token_b_in < 1n
        // then failwith(err_zero_b_in)
        // else skip;

        if pair.total_supply =/= 0n
        then failwith(err_pair_listed)
        else skip;
        pair.tokens_count := params.n_tokens;
        // pair.pools := params.input_tokens;

        var token_sum : nat := 0n;

        for key -> value in map params.input_tokens
          block {
            token_sum := token_sum + value.in_amount;
            operations :=
              typed_transfer(
                Tezos.sender,
                Tezos.self_address,
                value.in_amount,
                value.asset
              ) # operations;
            pair.tokens[key] := value.asset;
            pair.pools[key] := value.in_amount;
            pair.virtual_pools[key] := value.in_amount;
            pair.token_rates[key] := value.rate;
        };

        const init_shares : nat = token_sum / inp_len;

        s.ledger[(Tezos.sender, token_id)] := record [
            balance    = init_shares;
            allowances = (set [] : set(address));
          ];
        pair.total_supply := init_shares;
        s.pairs[token_id] := pair;
        s.tokens[token_id] := pair.tokens;
      }
    | _                 -> skip
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

(* Provide liquidity (balanced) to the pool,
note: tokens should be approved before the operation *)
// function invest_liquidity(
//   const p               : action_type;
//   var s                 : storage_type)
//                         : return_type is
//   block {
//     var operations: list(operation) := no_operations;
//     case p of
//       Invest(params) -> {
//         var pair : pair_type := get_pair(params.pair_id, s);

//         if pair.token_a_pool * pair.token_b_pool = 0n
//         then failwith(err_no_liquidity)
//         else skip;
//         if params.shares = 0n
//         then failwith(err_zero_in)
//         else skip;

//         var tokens_a_required : nat := div_ceil(params.shares
//           * pair.token_a_pool, pair.total_supply);
//         var tokens_b_required : nat := div_ceil(params.shares
//           * pair.token_b_pool, pair.total_supply);

//         if tokens_a_required > params.token_a_in
//         then failwith(err_low_max_a_in)
//         else skip;
//         if tokens_b_required > params.token_b_in
//         then failwith(err_low_max_b_in)
//         else skip;

//         var account : account_info := get_account((Tezos.sender,
//           params.pair_id), s);
//         const share : nat = account.balance;

//         account.balance := share + params.shares;
//         s.ledger[(Tezos.sender, params.pair_id)] := account;

//         pair.token_a_pool := pair.token_a_pool + tokens_a_required;
//         pair.token_b_pool := pair.token_b_pool + tokens_b_required;

//         pair.total_supply := pair.total_supply + params.shares;
//         s.pairs[params.pair_id] := pair;

//         const tokens : tokens_type = get_tokens(params.pair_id, s);
//         operations := list [
//           typed_transfer(
//             Tezos.sender,
//             Tezos.self_address,
//             tokens_a_required,
//             tokens.token_a_type
//           );
//           typed_transfer(
//             Tezos.sender,
//             Tezos.self_address,
//             tokens_b_required,
//             tokens.token_b_type
//           );
//         ];
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
        s.pairs[params.pair_id] := pair;
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
      s.pairs[pair_id] := pair;
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
      s.pairs[params.pair_id] := pair;
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
      s.pairs[params.pair_id] := pair;
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



