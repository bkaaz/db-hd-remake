/**
 * The 65816's 256 opcodes, as mnemonic and addressing mode. Kept apart from
 * the decoder because it is a table to check against a datasheet, not logic.
 *
 * Mode names:
 *   imp  none          acc  A            im   #imm, width from M    ix  #imm, width from X
 *   i8   #imm8         d    dp           dx   dp,X                 dy  dp,Y
 *   di   (dp)          dix  (dp,X)       diy  (dp),Y               dil [dp]     dily [dp],Y
 *   a    abs           ax   abs,X        ay   abs,Y                l   long     lx   long,X
 *   ai   (abs)         aix  (abs,X)      ail  [abs]
 *   s    sr,S          siy  (sr,S),Y     r    rel8                 rl  rel16    bm  src,dst
 */

export type Mode =
  | "imp" | "acc" | "im" | "ix" | "i8"
  | "d" | "dx" | "dy" | "di" | "dix" | "diy" | "dil" | "dily"
  | "a" | "ax" | "ay" | "l" | "lx" | "ai" | "aix" | "ail"
  | "s" | "siy" | "r" | "rl" | "bm";

const ROWS = [
  "BRK:i8 ORA:dix COP:i8 ORA:s TSB:d ORA:d ASL:d ORA:dil PHP:imp ORA:im ASL:acc PHD:imp TSB:a ORA:a ASL:a ORA:l",
  "BPL:r ORA:diy ORA:di ORA:siy TRB:d ORA:dx ASL:dx ORA:dily CLC:imp ORA:ay INC:acc TCS:imp TRB:a ORA:ax ASL:ax ORA:lx",
  "JSR:a AND:dix JSL:l AND:s BIT:d AND:d ROL:d AND:dil PLP:imp AND:im ROL:acc PLD:imp BIT:a AND:a ROL:a AND:l",
  "BMI:r AND:diy AND:di AND:siy BIT:dx AND:dx ROL:dx AND:dily SEC:imp AND:ay DEC:acc TSC:imp BIT:ax AND:ax ROL:ax AND:lx",
  "RTI:imp EOR:dix WDM:i8 EOR:s MVP:bm EOR:d LSR:d EOR:dil PHA:imp EOR:im LSR:acc PHK:imp JMP:a EOR:a LSR:a EOR:l",
  "BVC:r EOR:diy EOR:di EOR:siy MVN:bm EOR:dx LSR:dx EOR:dily CLI:imp EOR:ay PHY:imp TCD:imp JML:l EOR:ax LSR:ax EOR:lx",
  "RTS:imp ADC:dix PER:rl ADC:s STZ:d ADC:d ROR:d ADC:dil PLA:imp ADC:im ROR:acc RTL:imp JMP:ai ADC:a ROR:a ADC:l",
  "BVS:r ADC:diy ADC:di ADC:siy STZ:dx ADC:dx ROR:dx ADC:dily SEI:imp ADC:ay PLY:imp TDC:imp JMP:aix ADC:ax ROR:ax ADC:lx",
  "BRA:r STA:dix BRL:rl STA:s STY:d STA:d STX:d STA:dil DEY:imp BIT:im TXA:imp PHB:imp STY:a STA:a STX:a STA:l",
  "BCC:r STA:diy STA:di STA:siy STY:dx STA:dx STX:dy STA:dily TYA:imp STA:ay TXS:imp TXY:imp STZ:a STA:ax STZ:ax STA:lx",
  "LDY:ix LDA:dix LDX:ix LDA:s LDY:d LDA:d LDX:d LDA:dil TAY:imp LDA:im TAX:imp PLB:imp LDY:a LDA:a LDX:a LDA:l",
  "BCS:r LDA:diy LDA:di LDA:siy LDY:dx LDA:dx LDX:dy LDA:dily CLV:imp LDA:ay TSX:imp TYX:imp LDY:ax LDA:ax LDX:ay LDA:lx",
  "CPY:ix CMP:dix REP:i8 CMP:s CPY:d CMP:d DEC:d CMP:dil INY:imp CMP:im DEX:imp WAI:imp CPY:a CMP:a DEC:a CMP:l",
  "BNE:r CMP:diy CMP:di CMP:siy PEI:di CMP:dx DEC:dx CMP:dily CLD:imp CMP:ay PHX:imp STP:imp JML:ail CMP:ax DEC:ax CMP:lx",
  "CPX:ix SBC:dix SEP:i8 SBC:s CPX:d SBC:d INC:d SBC:dil INX:imp SBC:im NOP:imp XBA:imp CPX:a SBC:a INC:a SBC:l",
  "BEQ:r SBC:diy SBC:di SBC:siy PEA:a SBC:dx INC:dx SBC:dily SED:imp SBC:ay PLX:imp XCE:imp JSR:aix SBC:ax INC:ax SBC:lx",
];

export const OPCODES: { mnemonic: string; mode: Mode }[] = ROWS.flatMap((row) =>
  row.split(" ").map((cell) => {
    const [mnemonic, mode] = cell.split(":");
    return { mnemonic, mode: mode as Mode };
  }),
);

/** Operand bytes after the opcode; `im`/`ix` depend on the register width. */
export function operandSize(mode: Mode, m8: boolean, x8: boolean): number {
  switch (mode) {
    case "imp": case "acc": return 0;
    case "im": return m8 ? 1 : 2;
    case "ix": return x8 ? 1 : 2;
    case "a": case "ax": case "ay": case "ai": case "aix": case "ail": case "rl": case "bm": return 2;
    case "l": case "lx": return 3;
    default: return 1;
  }
}
