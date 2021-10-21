function add_liq(
    const params  : record [
                      referral: option(address);
                      pair_id :nat;
                      pair    : pair_type;
                      inputs  : map(nat, nat);
                      min_mint_amount: nat;
                    ];
    var   s       : storage_type
  ): return_type is
  block {
    var pair : pair_type := params.pair;
    const tokens = get_tokens(params.pair_id, s);
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
    var new_reserves := Map.map(add_inputs, init_reserves);

    const d1 = _get_D_mem(new_reserves, amp, pair);

    assert(d1 > d0);
    var mint_amount := 0n;
    if token_supply > 0n
      then {
        // Only account for fees if we are not the first to deposit
        // const fee = sum_all_fee(pair) * tokens_count / (4 * (tokens_count - 1));
        // const wo_lp_fee = sum_wo_lp_fee(pair) * tokens_count / (4 * (tokens_count - 1));
        const init = record [
          reserves = new_reserves;
          storage = s;
        ];
        // const referral: address = case (params.referral: option(address)) of
        //         Some(ref) -> ref
        //       | None -> get_default_refer(s)
        //       end;

        function calc_invests(
          const acc: record [
            reserves: map(token_pool_index, nat);
            storage: storage_type;
          ];
          const entry: (token_pool_index * token_type)
          ): record [
            reserves: map(token_pool_index, nat);
            storage: storage_type;
          ] is
          block {
            var result := acc;
            const i = entry.0;
            const old_balance = case init_reserves[i] of
                            Some(bal) -> bal
                          | None -> (failwith("No such reserve"): nat)
                          end;
            const new_balance = case acc.reserves[i] of
                            Some(bal) -> bal
                          | None -> (failwith("No such reserve"): nat)
                          end;

            const _ideal_balance = d1 * old_balance / d0;
            // const difference = abs(ideal_balance - new_balance);
            // const fee_norm = fee * difference / FEE_DENOMINATOR;
            // const after_fees = apply_invest_fee(referral, params.pair_id, i, difference, new_balance, acc.storage);
            // pair.virtual_reserves[i] := abs(new_balance - (wo_lp_fee / FEE_DENOMINATOR));
            result.reserves[i] := new_balance; // abs(new_balance - fee_norm);
            // result.storage := after_fees.1;
          } with result;

        const upd = Map.fold(calc_invests, tokens, init);


        // for _i := 0 to int(tokens_count)
        //   block {
        //     const i = case is_nat(_i) of
        //         Some(i) -> i
        //       | None -> (failwith("below zero"): nat)
        //       end;
        //     const old_balance = case init_reserves[i] of
        //                     Some(bal) -> bal
        //                   | None -> (failwith("No such reserve"): nat)
        //                   end;
        //     const new_balance = case _new_reserves[i] of
        //                     Some(bal) -> bal
        //                   | None -> (failwith("No such reserve"): nat)
        //                   end;

        //     const ideal_balance = d1 * old_balance / d0;
        //     const difference = abs(ideal_balance - new_balance);
        //     // const fee_norm = fee * difference / FEE_DENOMINATOR;
        //     const referral: address = case (params.referral: option(address)) of
        //         Some(ref) -> ref
        //       | None -> get_default_refer(s)
        //       end;

        //     const after_fees = apply_invest_fee(referral, params.pair_id, i, difference, new_balance, new_storage);

        //     // pair.virtual_reserves[i] := abs(new_balance - (wo_lp_fee / FEE_DENOMINATOR));
        //     _new_reserves[i] := after_fees.0; // abs(new_balance - fee_norm);
        //     new_storage := after_fees.1;
        //   };
        s := upd.storage;
        pair := get_pair(params.pair_id, s);
        const d2 = _get_D_mem(upd.reserves, amp, pair);
        mint_amount := token_supply * abs(d2 - d0) / d0;
      }
    else {
        pair.virtual_reserves := new_reserves;
        mint_amount := d1;  // Take the dust if there was any
    };
    assert(mint_amount >= params.min_mint_amount); // "Slippage screwed you"
    function transfer_to_pool(const acc : return_type; const input : nat * nat) : return_type is
      (typed_transfer(
        Tezos.sender,
        Tezos.self_address,
        input.1,
        get_token_by_id(input.0, params.pair_id, acc.1)
      ) # acc.0, acc.1);
    pair.total_supply := pair.total_supply + mint_amount;
    s.ledger[(Tezos.sender, params.pair_id)] := mint_amount;
    s.pools[params.pair_id] := pair;
  } with Map.fold(transfer_to_pool, params.inputs, (no_operations, s))



(* Initialize exchange after the previous liquidity was drained *)
function initialize_exchange(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
    | AddPair(params) -> {
      is_admin(s);
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
          map(token_pool_index, nat)
        );
        const entry : (token_pool_index * input_token)
      )             : (
          map(token_pool_index, nat) *
          map(token_pool_index, nat) *
          map(token_pool_index, nat)
        ) is (
          Map.add(entry.0, entry.1.rate,      acc.0),
          Map.add(entry.0, entry.1.in_amount, acc.1),
          Map.add(entry.0, 0n,                acc.2)
        );

      const (token_rates, inputs, zeros) = Map.fold(
        map_rates_outs_zeros,
        params.input_tokens,
        (
          (map[]: map(token_pool_index, nat)),
          (map[]: map(token_pool_index, nat)),
          (map[]: map(token_pool_index, nat))
        )
      );

      if pair_i.total_supply =/= 0n
      then failwith(err_pair_listed)
      else skip;

      var new_pair: pair_type := pair_i;
      new_pair.initial_A := params.a_constant;
      new_pair.future_A := params.a_constant;
      new_pair.initial_A_time := Tezos.now;
      new_pair.future_A_time := Tezos.now;
      new_pair.token_rates := token_rates;
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

// (* Swap tokens *)
function swap(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
    | Swap(params) -> {
        const i = params.idx_from;
        const dx = params.amount;
        const j = params.idx_to;
        const min_y = params.min_amount_out;

        if dx = 0n
          then failwith(err_zero_in)
        else skip;

        var pair : pair_type := get_pair(params.pair_id, s);
        const tokens        : tokens_type = get_tokens(params.pair_id, s);
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


        const dy = preform_swap(i, j, dx, pair);
        // TODO: perform fee separation
        if dy < min_y
          then failwith(err_high_min_out)
        else skip;

        pair.virtual_reserves[i] := old_virt_reserves_i + dx;
        pair.reserves[i] := old_reserves_i + dx;
        pair.virtual_reserves[j] := abs(old_virt_reserves_j - dy);
        pair.reserves[j] := abs(old_reserves_j - dy);

        s.pools[params.pair_id] := pair;

        operations := typed_transfer(
          Tezos.sender,
          Tezos.self_address,
          dx,
          token_i
        ) # operations;

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
    }
    | _ -> skip
    end
  } with (operations, s)

(* Remove liquidity (balanced) from the pool by burning shares *)
function divest_liquidity(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
      Divest(params) -> {

        if s.pools_count <= params.pair_id
          then failwith(err_pair_not_listed)
        else skip;

        var   pair          : pair_type := get_pair(params.pair_id, s);
        const tokens        : tokens_type = get_tokens(params.pair_id, s);
        const share         : nat = get_account((Tezos.sender, params.pair_id), s);
        const total_supply  : nat = pair.total_supply;

        if params.shares > share
          then failwith(err_insufficient_lp)
        else skip;

        function divest_reserves(
          const acc: (
            map(token_pool_index, nat) *
            map(token_pool_index, nat) *
            list(operation)
          );
          const entry: (token_pool_index * token_type)
        ) : (
            map(token_pool_index, nat) *
            map(token_pool_index, nat) *
            list(operation)
          ) is
          block {
            const old_balance = case acc.0[entry.0] of
              | Some(reserve) -> reserve
              | None -> 0n
              end;
            const old_virt_balance = case acc.1[entry.0] of
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

            const value = old_virt_balance * params.shares / total_supply;

            if value < min_amount_out
              then failwith(err_high_min_out);
            else if value = 0n
              then failwith(err_dust_out)
            else if value > old_balance
              then if value <= old_virt_balance
                    then skip; //TODO: add request to proxy;
                   else failwith(err_no_liquidity);
            else skip;

            var result := acc;

            result.0[entry.0] := abs(old_balance - value);
            result.1[entry.0] := abs(old_virt_balance - value);
            result.2 := typed_transfer(
              Tezos.sender,
              Tezos.self_address,
              value,
              token
            ) # result.2;

          } with result;

        const res = Map.fold(divest_reserves, tokens, (pair.reserves, pair.virtual_reserves, operations));

        pair.total_supply := abs(pair.total_supply - params.shares);
        pair.reserves := res.0;
        pair.virtual_reserves := res.1;

        s.ledger[(Tezos.sender, params.pair_id)] := abs(share - params.shares);
        s.pools[params.pair_id] := pair;

        operations := res.2;
      }
    | _                 -> skip
    end
  } with (operations, s)

(* DEX admin methods *)

(* ramping A constant *)
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



