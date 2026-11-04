// The Christmas theme: snow on the banks, Christmas trees, presents and snowmen, a Santa hat on the
// duck, sleigh bells, and falling snow. It comes on by itself from 12 November to 6 January. The
// grown-ups' Christmas switch on the title screen (choice, remembered) beats the date, and
// ?christmas=1 or ?christmas=0 in the address beats both.

export function christmas(date, search = "", choice = null) {
  const ask = new URLSearchParams(search).get("christmas");
  if (ask === "1" || ask === "0") return ask === "1";
  if (typeof choice === "boolean") return choice;
  const month = date.getMonth(), day = date.getDate();
  return (month === 10 && day >= 12) || month === 11 || (month === 0 && day <= 6);
}
