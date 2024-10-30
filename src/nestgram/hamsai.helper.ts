import { AnchorProvider, BN, Program, Wallet } from '@project-serum/anchor';
import { Hamsai as HamsaiType, IDL } from '../pool_configurator/idl/hamsai';
import {
  AccountMeta,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { config } from 'dotenv';
import { decode } from 'bs58';
config();

export const connection = new Connection(
  process.env.RPC_CONNECTION!,
  'confirmed',
);
export const hamsaiProgram = new Program<HamsaiType>(
  IDL,
  process.env.HAMSAI_PROGRAM_ID!,
  new AnchorProvider(connection, new Wallet(Keypair.generate()), {}),
);

export const hamsaiSeed = Buffer.from('hamsai');
export const globalSeed = Buffer.from('global');

export const authority = Keypair.fromSecretKey(
  decode(process.env.AUTHORITY_KEY!),
);

export function getGamePda() {
  return PublicKey.findProgramAddressSync(
    [hamsaiSeed],
    hamsaiProgram.programId,
  )[0];
}

export function getTreasurySeed(poolId: number) {
  const buff = Buffer.alloc(2);
  buff.writeUint16LE(poolId);

  return PublicKey.findProgramAddressSync(
    [hamsaiSeed, buff],
    hamsaiProgram.programId,
  )[0];
}

export function getGlobalTreasuryPda() {
  return PublicKey.findProgramAddressSync(
    [globalSeed],
    hamsaiProgram.programId,
  )[0];
}

export async function getPlaceBet(
  payer: PublicKey,
  poolId: number,
  betAmount: number,
) {
  const ix = hamsaiProgram.methods
    .placeBet(poolId, new BN(betAmount))
    .accounts({
      betTreasury: getTreasurySeed(poolId),
      gameConfig: getGamePda(),
      payer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return ix;
}

export async function getGameData() {
  const game = await hamsaiProgram.account.gameConfig.fetch(getGamePda());
  return game;
}

export async function getResolveBetIxs(winningPool: number) {
  const gameData = await getGameData();

  const remainingAccounts: AccountMeta[] = gameData.players.map((p) => {
    return {
      isSigner: false,
      isWritable: true,
      pubkey: p.user,
    };
  });

  const treasuryAccounts: AccountMeta[] = gameData.activePools.map((p) => ({
    isSigner: false,
    isWritable: true,
    pubkey: getTreasurySeed(p.id),
  }));
  const preResolveBet = await hamsaiProgram.methods
    .preResolve()
    .accounts({
      authority: authority.publicKey,
      gameConfig: getGamePda(),
      globalTreasury: getGlobalTreasuryPda(),
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(treasuryAccounts)
    .instruction();

  const resolveBet = await hamsaiProgram.methods
    .resolveBet(winningPool)
    .accounts({
      authority: authority.publicKey,
      gameConfig: getGamePda(),
      globalTreasury: getGlobalTreasuryPda(),
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  return [preResolveBet, resolveBet];
}

export async function getStartMission(duration: number) {
  const gameData = await getGameData();

  const poolsTreasuries: AccountMeta[] = gameData.activePools.map((p) => ({
    isSigner: false,
    isWritable: true,
    pubkey: getTreasurySeed(p.id),
  }));
  const ix = await hamsaiProgram.methods
    .startNewBet(new BN(duration))
    .accounts({
      authority: authority.publicKey,
      gameConfig: getGamePda(),
    })
    .remainingAccounts(poolsTreasuries)
    .instruction();

  return ix;
}

export async function sendAndConfirmTx(
  ix: TransactionInstruction[],
  signers?: Keypair[],
) {
  ix.unshift(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 9000000 }),
  );
  const txMessage = new TransactionMessage({
    instructions: ix,
    payerKey: signers ? signers[0].publicKey : authority.publicKey,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  }).compileToV0Message();

  const tx = new VersionedTransaction(txMessage);

  if (!signers) {
    tx.sign([authority]);
  } else {
    ix.forEach((i) =>
      i.keys.forEach((k) => {
        if (k.isSigner) {
          console.log(k.pubkey.toString(), 'SIF');
        }
      }),
    );
    tx.sign(signers);
  }

  const txSig = await connection.sendRawTransaction(tx.serialize());

  await connection.confirmTransaction({
    signature: txSig,
    ...(await connection.getLatestBlockhash()),
  });

  return txSig;
}

export async function getBalance(wallet: string): Promise<number> {
  const mint = new PublicKey(process.env.MINT);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(wallet),
    { mint },
  );

  if (!tokenAccounts.value.length) {
    return 0;
  }

  const totalBalance = tokenAccounts.value.reduce(
    (acc, val) => acc + val.account.data.parsed.info.tokenAmount.uiAmount,
    0,
  );

  return totalBalance;
}
