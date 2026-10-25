"""Explicit official-directory exceptions. No fuzzy state/city coercion."""
def directory_state(label, supported):
    state = {'D.C.': 'DC'}.get(label, label)
    return state if state in supported else None
