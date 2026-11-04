// The Christmas theme: snow on the banks, Christmas trees, presents and snowmen, a Santa hat on the
// duck, sleigh bells, and falling snow. It comes on by itself from 1 December to 6 January.
// ?christmas=1 in the address turns it on any day, and ?christmas=0 turns it off.

export function christmas(date, search = "") {
  const ask = new URLSearchParams(search).get("christmas");
  if (ask === "1") return true;
  if (ask === "0") return false;
  const month = date.getMonth(), day = date.getDate();
  return month === 11 || (month === 0 && day <= 6);
}
