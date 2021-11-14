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
      const n_tokens = Set.size(params.input_tokens);

      assert_with_error(
        n_tokens < CONSTANTS.max_tokens_count
        and n_tokens >= CONSTANTS.min_tokens_count
        and n_tokens = Map.size(params.tokens_info), ERRORS.wrong_tokens_count);

      function get_tokens_from_param(
        var result    : tmp_tokens_type;
        const value   : token_type)
                      : tmp_tokens_type is
        block {
          result.tokens[result.index] := value;
          result.index := result.index + 1n;
        }
        with result;

      const result: tmp_tokens_type = Set.fold(
        get_tokens_from_param,
        params.input_tokens,
        default_tmp_tokens);

      const tokens : tokens_type = result.tokens;
      const token_bytes : bytes = Bytes.pack(tokens);
      var (pair_i, token_id) := get_pair_info(token_bytes,
        s.pools_count,
        s.pool_to_id,
        s.pools);
      s.tokens[token_id] := tokens;

      assert_with_error(pair_i.total_supply = 0n, ERRORS.pair_listed);

      if s.pools_count = token_id
      then {
        s.pool_to_id[token_bytes] := token_id;
        s.pools_count := s.pools_count + 1n;
      }
      else skip;

      assert_with_error(
        CONSTANTS.max_a >= params.a_constant,
        ERRORS.a_limit);

      patch pair_i with record [
        initial_A = params.a_constant;
        future_A = params.a_constant;
        initial_A_time = Tezos.now;
        future_A_time = Tezos.now;
        tokens_info = params.tokens_info;
      ];

      function get_inputs(
        const _key        : token_pool_index;
        var token_info    : token_info_type)
                          : nat is
        block {
          assert_with_error(
            token_info.reserves = token_info.virtual_reserves,
            ERRORS.wrong_tokens_in);
        } with token_info.reserves;

      const res = add_liq(record [
        referral = (None: option(address));
        pair_id = token_id;
        pair    = pair_i;
        inputs  = Map.map(get_inputs, params.tokens_info);
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
        const dx = params.amount;
        assert_with_error(dx =/= 0n, ERRORS.zero_in);

        const tokens : tokens_type = get_tokens(params.pair_id, s.tokens);
        const tokens_count = Map.size(tokens);
        const i = params.idx_from;
        const j = params.idx_to;
        assert_with_error(i < tokens_count or j < tokens_count, ERRORS.wrong_index);

        var pair : pair_type := get_pair(params.pair_id, s.pools);
        var dy := preform_swap(i, j, dx, pair);
        const after_fees = perform_fee_slice(dy, pair.fee, pair.staker_accumulator.total_staked);
        dy := after_fees.0;

        const to_stakers = after_fees.3;

        const referral: address = get_address(params.referral, s.default_referral);
        const token_j = get_token(j, tokens);
        s.referral_rewards[(referral, token_j)] :=
          get_ref_rewards((referral, token_j), s.referral_rewards) +
          after_fees.1;
        s.dev_rewards[token_j] := get_dev_rewards(token_j, s.dev_rewards) + after_fees.2;

        if to_stakers > 0n
         then pair.staker_accumulator.accumulator[j] := case pair.staker_accumulator.accumulator[j] of
          | Some(rew) -> rew + to_stakers * CONSTANTS.stkr_acc_precision / pair.staker_accumulator.total_staked
          | None -> to_stakers * CONSTANTS.stkr_acc_precision / pair.staker_accumulator.total_staked
          end;
        else skip;

        assert_with_error(dy >= params.min_amount_out, ERRORS.high_min_out);

        var token_info_i := get_token_info(i, pair.tokens_info);
        patch token_info_i with record [
          virtual_reserves = token_info_i.virtual_reserves + dx;
          reserves = token_info_i.reserves + dx;
        ];
        var token_info_j := get_token_info(j, pair.tokens_info);
        patch token_info_j with record [
          virtual_reserves = nat_or_error(token_info_j.virtual_reserves - dy, "dy>reserves");
          reserves = nat_or_error(token_info_j.reserves - dy, "dy>reserves");
        ];

        pair.tokens_info[i] := token_info_i;
        pair.tokens_info[j] := token_info_j;
        s.pools[params.pair_id] := pair;

        operations := typed_transfer(
          Tezos.self_address,
          get_address(params.receiver, Tezos.sender),
          dy,
          token_j
        ) # operations;
        operations := typed_transfer(
          Tezos.sender,
          Tezos.self_address,
          dx,
          get_token(i, tokens)
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
        const result = add_liq(record[
          referral= params.referral;
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
        assert_with_error(s.pools_count > params.pair_id, ERRORS.pair_not_listed);
        assert_with_error(params.shares =/= 0n, ERRORS.zero_in);

        var   pair          : pair_type := get_pair(params.pair_id, s.pools);
        const total_supply  : nat = pair.total_supply;

        function divest_reserves(
          var acc: (
            map(token_pool_index, token_info_type) *
            list(operation)
          );
          const entry: (token_pool_index * token_type)
        ) : (
            map(token_pool_index, token_info_type) *
            list(operation)
          ) is
          block {
            var token_info := get_token_info(entry.0, acc.0);

            const min_amount_out = case params.min_amounts_out[entry.0] of
              | Some(min) -> min
              | None -> 1n
              end;

            const value = token_info.virtual_reserves * params.shares / total_supply;
            token_info.virtual_reserves := nat_or_error(token_info.virtual_reserves - value, "value>virt_reserves");
            token_info.reserves := nat_or_error(token_info.reserves - value, "value>virt_reserves");
            acc.0[entry.0] := token_info;

            assert_with_error(value >= min_amount_out, ERRORS.high_min_out);
            assert_with_error(value =/= 0n, ERRORS.dust_out);

            if value > token_info.reserves
              then skip //TODO: add request to proxy;
            else {
              acc.1 := typed_transfer(
                Tezos.sender,
                Tezos.self_address,
                value,
                entry.1
              ) # acc.1;
            }
          } with acc;

        const tokens : tokens_type = get_tokens(params.pair_id, s.tokens);
        const res = Map.fold(divest_reserves, tokens, (pair.tokens_info, operations));
        pair.tokens_info := res.0;
        pair.total_supply := nat_or_error(pair.total_supply - params.shares, "total_supply<shares");
        const share : nat = get_account_balance((Tezos.sender, params.pair_id), s.ledger);
        s.ledger[(Tezos.sender, params.pair_id)] := nat_or_error(share - params.shares, ERRORS.insufficient_lp);
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
        assert(Tezos.now >= pair.initial_A_time + CONSTANTS.min_ramp_time);
        assert(params.future_time >= Tezos.now + CONSTANTS.min_ramp_time); //  # dev: insufficient time

        const initial_A: nat = _A(
          pair.initial_A_time,
          pair.initial_A,
          pair.future_A_time,
          pair.future_A
        );
        const future_A_p: nat = params.future_A * CONSTANTS.a_precision;

        assert((params.future_A > 0n) and (params.future_A < CONSTANTS.max_a));
        if future_A_p < initial_A
          then assert(future_A_p * CONSTANTS.max_a_change >= initial_A)
        else assert(future_A_p <= initial_A * CONSTANTS.max_a_change);

        pair.initial_A := initial_A;
        pair.future_A := future_A_p;
        pair.initial_A_time := Tezos.now;
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
      const current_A: nat = _A(
        pair.initial_A_time,
        pair.initial_A,
        pair.future_A_time,
        pair.future_A
      );
      pair.initial_A := current_A;
      pair.future_A := current_A;
      pair.initial_A_time := Tezos.now;
      pair.future_A_time := Tezos.now;
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
      var token_info := case pair.tokens_info[params.token_index] of
      | Some(value) -> value
      | None -> (failwith("no such R index") : token_info_type)
      end;

      token_info.proxy_limit := params.limit;
      pair.tokens_info[params.token_index] := token_info;

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

// function claim_variant(
//   const acc: return_type;
//   const claim_action: claim_actions
//   ): return_type is
//   block {
//     var operations: list(operation) := acc.0;
//     var s: storage_type := acc.1;
//     case claim_action of
//         | Developer(params) -> {
//             is_admin_or_dev(s.admin, s.dev_address);
//             const dev_balance = case s.dev_rewards[params.token] of
//             | Some(bal) -> bal
//             | None -> 0n
//             end;
//             if dev_balance > 0n
//               then {
//                 operations := typed_transfer(
//                   Tezos.self_address,
//                   s.dev_address,
//                   params.amount,
//                   params.token
//                 ) # operations;
//                 s.dev_rewards[params.token] := nat_or_error(dev_balance-params.amount, "Amount greater than balance");
//               }
//             else failwith("Balance is 0")
//           }
//         | Referral(params) -> {
//             const ref_balance = case s.referral_rewards[(Tezos.sender, params.token)] of
//             | Some(bal) -> bal
//             | None -> 0n
//             end;
//             if ref_balance > 0n
//               then {
//                 operations := typed_transfer(
//                   Tezos.self_address,
//                   Tezos.sender,
//                   params.amount,
//                   params.token
//                 ) # operations;
//                 s.referral_rewards[(Tezos.sender, params.token)] := nat_or_error(ref_balance-params.amount, "Amount greater than balance");
//             }
//             else failwith("Balance is 0");
//           }
//         | Staking(params) -> {
//             const staker_key = (Tezos.sender, params.pool_id);
//             var staker_acc := get_staker_acc(staker_key, s.stakers_balance);
//             var staker_rew_data: acc_reward_type := case staker_acc.earnings[params.token_index] of
//             | Some(data) -> data
//             | None -> record [
//               reward  = 0n;
//               former  = 0n;
//             ]
//             end;
//             const staker_rew_balance = staker_rew_data.reward;
//             if staker_rew_balance > 0n
//               then {
//                 operations := typed_transfer(
//                   Tezos.self_address,
//                   Tezos.sender,
//                   params.amount,
//                   get_token_by_id(params.token_index, s.tokens[params.pool_id])
//                 ) # operations;
//                 staker_rew_data.reward := nat_or_error(staker_rew_balance - params.amount, "Amount greater than balance");
//                 staker_rew_data.former := 0n;
//               }
//             else failwith("Balance is 0");
//             staker_acc.earnings[params.token_index] := staker_rew_data;
//             s.stakers_balance[staker_key] := staker_acc;
//           }
//         | LProvider(params) -> {
//             const acc_key = (Tezos.sender, params.pool_id);
//             var acc_data := get_account_data(acc_key, s.account_data);
//             var acc_intrst_data: acc_reward_type := case acc_data.earned_interest[params.token] of
//               | Some(data) -> data
//               | None -> record [
//                 reward  = 0n;
//                 former  = 0n;
//               ]
//               end;
//             const acc_intrst_balance = acc_intrst_data.reward;
//             if acc_intrst_balance > 0n
//               then {
//                 operations := typed_transfer(
//                   Tezos.self_address,
//                   Tezos.sender,
//                   params.amount,
//                   params.token
//                 ) # operations;
//                 acc_intrst_data.reward := 0n;
//                 acc_intrst_data.former := 0n;
//               }
//             else failwith("Balance is 0");
//             acc_data.earned_interest[params.token] := acc_intrst_data;
//             s.account_data[acc_key] := acc_data;
//           }
//       end;
//   } with (operations, s)

// function claim_middle(
//   const p : action_type;
//   var s   : storage_type)
//           : return_type is
//   case p of
//   | Claim(params) -> List.fold(
//       claim_variant,
//       params,
//       (CONSTANTS.no_operations, s)
//     )
//   | _ -> (CONSTANTS.no_operations, s)
//   end

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