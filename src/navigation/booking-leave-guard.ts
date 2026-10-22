type ConfirmLeave = (leave: () => void, stay: () => void) => void;

export function createBookingLeaveGuard(confirm: ConfirmLeave) {
  const entries = new Map<string, { discard: () => void }>();
  let prompting = false;

  function register(source: string, discard: () => void) {
    const entry = { discard };
    entries.set(source, entry);
    return () => { if (entries.get(source) === entry) entries.delete(source); };
  }

  function request(source: string, destination: string | null, proceed: () => void) {
    const entry = entries.get(source);
    if (!entry || destination === source) {
      proceed();
      return;
    }
    if (prompting) return;
    prompting = true;
    confirm(() => {
      prompting = false;
      // A dialog must not navigate after its booking screen/session has gone away.
      if (entries.get(source) !== entry) return;
      entries.delete(source);
      entry.discard();
      proceed();
    }, () => { prompting = false; });
  }

  return { register, request };
}
