# GRIDIRON LIFE — Career balance simulation

## Scope

- Seed: 20260901
- Baseline: 11,000 balanced careers (1,000 per position).
- Strategy counterfactuals: 8,250 careers.
- Total executed: 19,250 careers.
- This is local deterministic QA output, not product analytics. It reads no player account or browser data and sends nothing over the network.

## Position results

| Pos. | Careers | NFL seasons | Peak OVR | Injuries | Contracts | Contract value | Titles | Pro Bowl / All-Pro / MVP | HoF | End: age / decline / injury |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| QB | 1000 | 11.933 | 80.072 (max 91) | 2633 (93.8% careers) | 5.230 | $233,606,340 | 1727 | 42 / 0 / 0 | 15 | 6 / 979 / 15 |
| RB | 1000 | 11.930 | 76.646 (max 83) | 2709 (93.3% careers) | 5.171 | $231,995,323 | 1742 | 223 / 0 / 0 | 37 | 7 / 982 / 11 |
| WR | 1000 | 11.747 | 76.309 (max 82) | 2658 (92.9% careers) | 5.110 | $229,875,052 | 1663 | 516 / 5 / 0 | 14 | 5 / 983 / 12 |
| TE | 1000 | 11.708 | 76.944 (max 84) | 2580 (93.2% careers) | 5.161 | $227,536,614 | 1689 | 174 / 0 / 0 | 12 | 5 / 979 / 16 |
| OL | 1000 | 11.814 | 80.189 (max 98) | 2574 (92.1% careers) | 5.225 | $220,423,417 | 1691 | 1157 / 571 / 0 | 59 | 3 / 984 / 13 |
| DL | 1000 | 11.735 | 80.580 (max 99) | 2627 (92.6% careers) | 5.184 | $222,632,184 | 1665 | 885 / 214 / 0 | 93 | 7 / 983 / 10 |
| LB | 1000 | 11.910 | 80.049 (max 89) | 2662 (92.5% careers) | 5.116 | $241,484,054 | 1709 | 296 / 0 / 0 | 26 | 6 / 985 / 9 |
| CB | 1000 | 11.942 | 76.946 (max 83) | 2802 (94.3% careers) | 5.191 | $233,510,490 | 1720 | 398 / 0 / 0 | 32 | 9 / 977 / 14 |
| S | 1000 | 11.863 | 79.713 (max 99) | 2687 (94.7% careers) | 5.281 | $217,661,401 | 1665 | 1397 / 684 / 0 | 149 | 5 / 983 / 12 |
| K | 1000 | 11.901 | 79.964 (max 99) | 2596 (92.3% careers) | 5.301 | $219,835,381 | 1658 | 1876 / 1059 / 0 | 153 | 13 / 976 / 11 |
| P | 1000 | 11.966 | 80.487 (max 99) | 2718 (93.2% careers) | 5.314 | $223,981,857 | 1685 | 939 / 311 / 0 | 57 | 5 / 983 / 12 |

## Strategy comparison

| Strategy | Careers | NFL seasons | Peak OVR | Injured careers | Injuries/career | Titles / 100 | HoF rate | Contract value |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| balanced | 2750 | 11.952 | 78.777 | 93.3% | 2.680 | 172.291 | 6.2% | $227,535,682 |
| grind | 2750 | 11.840 | 82.075 | 94.9% | 2.948 | 165.636 | 11.8% | $253,028,133 |
| recovery | 2750 | 11.764 | 73.409 | 89.7% | 2.304 | 171.091 | 2.3% | $193,204,303 |

## Findings

- [PASS] Peak overall is highest for grind (82.075).
- [PASS] Career length is highest for balanced (11.952 NFL seasons).
- [PASS] Injury exposure is lowest for recovery (89.7% of careers injured).
- [PASS] Aggregate contract value is highest for grind ($253,028,133).
- [PASS] No strategy dominates peak, longevity, injury exposure and contract value at the same time.
- [PASS] No impossible result was found across 19,250 deterministic careers: overall stayed within 0–99, contracts and championships were bounded by seasons, and all counters were non-negative.
- [PASS] K/P outcomes use field-goal, extra-point and punt production rather than the generic tackle-stat proxy.

## Interpretation limits

The cohort uses the live progression, ageing, injury, contract and legacy functions, but resolves a season in aggregate. It is a regression and balance signal, not a prediction of real-world athlete outcomes. Re-run with the same seed to reproduce any finding.
