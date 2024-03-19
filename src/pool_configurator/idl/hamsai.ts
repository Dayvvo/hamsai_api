export type Hamsai = {
  version: '0.1.0';
  name: 'hamsai';
  instructions: [
    {
      name: 'createConfig';
      accounts: [
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'gameConfig';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'pools';
          type: {
            vec: {
              defined: 'PoolData';
            };
          };
        },
        {
          name: 'action';
          type: {
            defined: 'PoolAction';
          };
        },
      ];
    },
    {
      name: 'startNewBet';
      accounts: [
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'gameConfig';
          isMut: true;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'duration';
          type: 'u64';
        },
      ];
    },
    {
      name: 'placeBet';
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'gameConfig';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'betTreasury';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'poolId';
          type: 'u16';
        },
        {
          name: 'betAmount';
          type: 'u64';
        },
      ];
    },
    {
      name: 'preResolve';
      accounts: [
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'globalTreasury';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'gameConfig';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'resolveBet';
      accounts: [
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'globalTreasury';
          isMut: true;
          isSigner: false;
          docs: ['CHECK'];
        },
        {
          name: 'gameConfig';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'winner';
          type: 'u8';
        },
      ];
    },
  ];
  accounts: [
    {
      name: 'gameConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'activePools';
            type: {
              vec: {
                defined: 'PoolData';
              };
            };
          },
          {
            name: 'activeSession';
            type: 'u64';
          },
          {
            name: 'players';
            type: {
              vec: {
                defined: 'PlayerData';
              };
            };
          },
          {
            name: 'duration';
            type: 'u64';
          },
          {
            name: 'startedAt';
            type: 'i64';
          },
          {
            name: 'lastWinningPool';
            type: 'u16';
          },
        ];
      };
    },
  ];
  types: [
    {
      name: 'PoolData';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'id';
            type: 'u16';
          },
          {
            name: 'totalBets';
            type: 'u64';
          },
          {
            name: 'currentSessionBets';
            type: 'u64';
          },
          {
            name: 'totalVolume';
            type: 'u64';
          },
          {
            name: 'currentSessionVolume';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'PlayerData';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'user';
            type: 'publicKey';
          },
          {
            name: 'betAmount';
            type: 'u64';
          },
          {
            name: 'poolBet';
            type: 'u16';
          },
        ];
      };
    },
    {
      name: 'RaceState';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Betting';
          },
          {
            name: 'Racing';
          },
          {
            name: 'Finished';
          },
        ];
      };
    },
    {
      name: 'PoolAction';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Add';
          },
          {
            name: 'Remove';
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'InvalidTreasuryPda';
      msg: 'Invalid treasury PDA!';
    },
    {
      code: 6001;
      name: 'PreviousGameNotResolved';
      msg: 'Previous game was not resolved';
    },
    {
      code: 6002;
      name: 'EntriesCapReached';
      msg: 'Session has 250 entries';
    },
    {
      code: 6003;
      name: 'YouAlreadyEnteredThisRound';
      msg: 'You already have entry in this round!';
    },
    {
      code: 6004;
      name: 'BetNotYetResolved';
      msg: 'Bet not yet resolved';
    },
    {
      code: 6005;
      name: 'NumericalOverflow';
      msg: 'Numerical overflow';
    },
    {
      code: 6006;
      name: 'InvalidWinnerKey';
      msg: 'Invalid winner key';
    },
    {
      code: 6007;
      name: 'InvalidBetAmount';
      msg: 'Invalid bet amount!';
    },
  ];
};

export const IDL: Hamsai = {
  version: '0.1.0',
  name: 'hamsai',
  instructions: [
    {
      name: 'createConfig',
      accounts: [
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'gameConfig',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'pools',
          type: {
            vec: {
              defined: 'PoolData',
            },
          },
        },
        {
          name: 'action',
          type: {
            defined: 'PoolAction',
          },
        },
      ],
    },
    {
      name: 'startNewBet',
      accounts: [
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'gameConfig',
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'duration',
          type: 'u64',
        },
      ],
    },
    {
      name: 'placeBet',
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'gameConfig',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'betTreasury',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'poolId',
          type: 'u16',
        },
        {
          name: 'betAmount',
          type: 'u64',
        },
      ],
    },
    {
      name: 'preResolve',
      accounts: [
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'globalTreasury',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'gameConfig',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'resolveBet',
      accounts: [
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'globalTreasury',
          isMut: true,
          isSigner: false,
          docs: ['CHECK'],
        },
        {
          name: 'gameConfig',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'winner',
          type: 'u8',
        },
      ],
    },
  ],
  accounts: [
    {
      name: 'gameConfig',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'activePools',
            type: {
              vec: {
                defined: 'PoolData',
              },
            },
          },
          {
            name: 'activeSession',
            type: 'u64',
          },
          {
            name: 'players',
            type: {
              vec: {
                defined: 'PlayerData',
              },
            },
          },
          {
            name: 'duration',
            type: 'u64',
          },
          {
            name: 'startedAt',
            type: 'i64',
          },
          {
            name: 'lastWinningPool',
            type: 'u16',
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'PoolData',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'id',
            type: 'u16',
          },
          {
            name: 'totalBets',
            type: 'u64',
          },
          {
            name: 'currentSessionBets',
            type: 'u64',
          },
          {
            name: 'totalVolume',
            type: 'u64',
          },
          {
            name: 'currentSessionVolume',
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'PlayerData',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'user',
            type: 'publicKey',
          },
          {
            name: 'betAmount',
            type: 'u64',
          },
          {
            name: 'poolBet',
            type: 'u16',
          },
        ],
      },
    },
    {
      name: 'RaceState',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Betting',
          },
          {
            name: 'Racing',
          },
          {
            name: 'Finished',
          },
        ],
      },
    },
    {
      name: 'PoolAction',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Add',
          },
          {
            name: 'Remove',
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'InvalidTreasuryPda',
      msg: 'Invalid treasury PDA!',
    },
    {
      code: 6001,
      name: 'PreviousGameNotResolved',
      msg: 'Previous game was not resolved',
    },
    {
      code: 6002,
      name: 'EntriesCapReached',
      msg: 'Session has 250 entries',
    },
    {
      code: 6003,
      name: 'YouAlreadyEnteredThisRound',
      msg: 'You already have entry in this round!',
    },
    {
      code: 6004,
      name: 'BetNotYetResolved',
      msg: 'Bet not yet resolved',
    },
    {
      code: 6005,
      name: 'NumericalOverflow',
      msg: 'Numerical overflow',
    },
    {
      code: 6006,
      name: 'InvalidWinnerKey',
      msg: 'Invalid winner key',
    },
    {
      code: 6007,
      name: 'InvalidBetAmount',
      msg: 'Invalid bet amount!',
    },
  ],
};
