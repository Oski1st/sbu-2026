"""Regression for the exact official Washington,D.C. label; no network required."""
import unittest
from ingestion import directory_state

class DirectoryStateTests(unittest.TestCase):
    def test_official_dc_label_is_not_dropped(self):
        name, state = 'Washington, D.C.'.rsplit(', ', 1)
        self.assertEqual((name, directory_state(state, {'DC', 'WA'})), ('Washington', 'DC'))

    def test_other_states_are_not_silently_changed(self):
        self.assertEqual(directory_state('WA', {'DC', 'WA'}), 'WA')
        self.assertEqual(directory_state('DC', {'DC', 'WA'}), 'DC')

    def test_unknown_or_out_of_scope_labels_stay_unresolved(self):
        for label in ['D.C.', 'BC', 'District of Columbia', 'D C', 'dc']:
            self.assertIsNone(directory_state(label, {'WA'}))

if __name__ == '__main__':
    unittest.main()
