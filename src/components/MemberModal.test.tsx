import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MemberModal from './MemberModal';
import { Member } from '../types';

const members: Member[] = [
  {
    id: 'parent-marie', firstname: 'Marie', lastname: 'Curie', gender: 'F',
    birth: null, birthplace: null, death: null, deathplace: null,
    parentId: null, spouseId: null, notes: null, photo: null,
  },
  {
    id: 'spouse-pierre', firstname: 'Pierre', lastname: 'Curie', gender: 'M',
    birth: null, birthplace: null, death: null, deathplace: null,
    parentId: null, spouseId: null, notes: null, photo: null,
  },
];

test('searches and selects parent and spouse from searchable member lists', async () => {
  const onSave = jest.fn(() => Promise.resolve());
  render(
    <MemberModal
      open
      editingMember={null}
      defaultParentId={null}
      members={members}
      onClose={jest.fn()}
      onSave={onSave}
      onDelete={jest.fn()}
    />
  );

  fireEvent.change(screen.getByLabelText(/Prénom/), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText(/Nom de famille/), { target: { value: 'Lovelace' } });

  const parentSearch = screen.getByRole('combobox', { name: 'Parent (père ou mère)' });
  fireEvent.change(parentSearch, { target: { value: 'Marie' } });
  fireEvent.click(await screen.findByRole('option', { name: 'Marie Curie' }));

  const spouseSearch = screen.getByRole('combobox', { name: 'Conjoint(e) (lien affiché)' });
  fireEvent.change(spouseSearch, { target: { value: 'Pierre' } });
  fireEvent.click(await screen.findByRole('option', { name: 'Pierre Curie' }));

  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form')!);

  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    firstname: 'Ada',
    lastname: 'Lovelace',
    parentId: 'parent-marie',
    spouseId: 'spouse-pierre',
  }));
});

test('searchable select filters members as text is entered', async () => {
  render(
    <MemberModal
      open
      editingMember={null}
      defaultParentId={null}
      members={members}
      onClose={jest.fn()}
      onSave={jest.fn(() => Promise.resolve())}
      onDelete={jest.fn()}
    />
  );

  fireEvent.focus(screen.getByRole('combobox', { name: 'Parent (père ou mère)' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Parent (père ou mère)' }), { target: { value: 'Marie' } });

  expect(await screen.findByRole('option', { name: 'Marie Curie' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Pierre Curie' })).not.toBeInTheDocument();
});