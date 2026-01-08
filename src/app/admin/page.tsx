"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// --- TIPE DATA ---
type RegistrationData = {
  id: string; 
  child_name: string;
  child_class: string;
};

type Seat = {
  id: string;
  row_name: string;
  seat_number: number;
  is_occupied: boolean;
  is_blocked: boolean;
  assigned_to: string | null;
  registrations?: RegistrationData | null;
};

type GroupedParticipant = {
  regId: string;
  childName: string;
  childClass: string;
  seatNumbers: string[];
};

// --- KOMPONEN TOAST ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border-l-8 animate-slide-in ${type === 'success' ? 'bg-white border-green-600 text-green-800' : 'bg-white border-red-600 text-red-800'}`}>
    <span className="text-2xl">{type === 'success' ? '✅' : '❌'}</span>
    <div>
      <h4 className="font-black text-sm uppercase">{type === 'success' ? 'Berhasil' : 'Gagal'}</h4>
      <p className="font-bold text-sm">{message}</p>
    </div>
    <button onClick={onClose} className="ml-4 text-gray-500 hover:text-black font-black">✕</button>
  </div>
);

// --- KOMPONEN MODAL KONFIRMASI ---
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all scale-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-700 font-semibold text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-colors">Batal</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30">Ya, Hapus</button>
        </div>
      </div>
    </div>
  );
};

export default function AdminPage() {
  // --- STATE UTAMA ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'map' | 'participants'>('map');
  const [searchTerm, setSearchTerm] = useState('');

  // --- STATE MODAL ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); 
  
  const [editData, setEditData] = useState<{ id: string; name: string; class: string } | null>(null);
  const [addData, setAddData] = useState<{ name: string; class: string }>({ name: '', class: 'KB B1' });

  // State Delete & Toast
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, regId: string | null }>({ isOpen: false, regId: null });
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  // FETCH DATA
  const fetchSeats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('seats')
      .select(`*, registrations (id, child_name, child_class)`)
      .order('row_name', { ascending: true })
      .order('seat_number', { ascending: true });
    
    if (data) {
      const formattedData = data.map((item) => {
        const reg = Array.isArray(item.registrations) ? item.registrations[0] : item.registrations;
        return { ...item, registrations: reg as RegistrationData | null };
      });
      setSeats(formattedData as Seat[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) fetchSeats();
  }, [isAuthenticated]);

  // --- ACTIONS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const secretPin = process.env.NEXT_PUBLIC_ADMIN_PIN;
    if (pin === secretPin) {
      setIsAuthenticated(true);
      showToast("Selamat Datang, Admin!", "success");
    } else {
      showToast("PIN Salah! Coba lagi.", "error");
    }
  };

  const toggleBlock = async (seat: Seat) => {
    if (seat.is_occupied) {
      showToast("Kursi ini terisi! Hapus data siswanya dulu.", "error");
      return;
    }
    const newStatus = !seat.is_blocked;
    setSeats(seats.map(s => s.id === seat.id ? { ...s, is_blocked: newStatus } : s));
    const { error } = await supabase.from('seats').update({ is_blocked: newStatus }).eq('id', seat.id);
    if (error) {
        showToast("Gagal update status kursi", "error");
        fetchSeats();
    }
  };

  // DELETE
  const confirmDelete = (regId: string) => setDeleteModal({ isOpen: true, regId });
  const executeDelete = async () => {
    if (!deleteModal.regId) return;
    try {
      await supabase.from('seats').update({ is_occupied: false, assigned_to: null }).eq('assigned_to', deleteModal.regId);
      await supabase.from('registrations').delete().eq('id', deleteModal.regId);
      showToast("Data dihapus & Kursi kosong!", "success");
      setDeleteModal({ isOpen: false, regId: null });
      fetchSeats(); 
    } catch (error) {
      console.error(error);
      showToast("Gagal menghapus data.", "error");
    }
  };

  // EDIT
  const openEditModal = (regId: string, currentName: string, currentClass: string) => {
    setEditData({ id: regId, name: currentName, class: currentClass });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editData) return;
    try {
      const { error } = await supabase
        .from('registrations')
        .update({ child_name: editData.name, child_class: editData.class })
        .eq('id', editData.id);

      if (error) throw error;
      showToast("Data siswa diperbarui!", "success");
      setIsEditModalOpen(false);
      fetchSeats(); 
    } catch (err) {
      console.error(err);
      showToast("Gagal update data.", "error");
    }
  };

  // TAMBAH MANUAL
  const handleManualAdd = async () => {
    if (!addData.name) {
      showToast("Nama siswa wajib diisi!", "error");
      return;
    }

    try {
      // 1. Cek Duplikat
      const { data: existingUser } = await supabase
        .from('registrations')
        .select('id')
        .ilike('child_name', addData.name)
        .eq('child_class', addData.class)
        .single();

      if (existingUser) {
        showToast("Siswa ini sudah terdaftar!", "error");
        return;
      }

      // 2. Cari 2 Kursi Kosong
      const { data: availableSeats } = await supabase
        .from('seats')
        .select('id')
        .eq('is_occupied', false)
        .eq('is_blocked', false)
        .order('row_name', { ascending: true })
        .order('seat_number', { ascending: true })
        .limit(2);

      if (!availableSeats || availableSeats.length < 2) {
        showToast("Kursi penuh! Tidak bisa tambah.", "error");
        return;
      }

      // 3. Simpan Registrasi
      const { data: registration, error: regError } = await supabase
        .from('registrations')
        .insert([{ parent_name: 'Admin Manual', child_name: addData.name, child_class: addData.class }])
        .select()
        .single();

      if (regError) throw regError;

      // 4. Assign Kursi
      const seatIds = availableSeats.map(s => s.id);
      await supabase.from('seats').update({ is_occupied: true, assigned_to: registration.id }).in('id', seatIds);

      showToast("Peserta berhasil ditambahkan!", "success");
      setIsAddModalOpen(false);
      setAddData({ name: '', class: 'KB B1' }); 
      fetchSeats();

    } catch (error) {
      console.error(error);
      showToast("Terjadi kesalahan sistem.", "error");
    }
  };

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  
  // GROUPING LOGIC
  const occupiedSeats = seats.filter(s => s.is_occupied && s.registrations);
  const mapReg = new Map<string, GroupedParticipant>();

  occupiedSeats.forEach(seat => {
    if (!seat.registrations) return;
    const regId = seat.registrations.id;
    if (!mapReg.has(regId)) {
      mapReg.set(regId, {
        regId: regId,
        childName: seat.registrations.child_name,
        childClass: seat.registrations.child_class,
        seatNumbers: []
      });
    }
    mapReg.get(regId)?.seatNumbers.push(seat.id);
  });

  const allGroupedList = Array.from(mapReg.values());
  const filteredParticipants = allGroupedList.filter(p => 
    p.childName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.seatNumbers.join('').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- LOGIN PAGE ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative">
        {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
        
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-3" style={{ background: 'linear-gradient(to right, #2563eb, #9333ea)' }}></div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 mt-4">ADMIN TK 🔒</h1>
          <p className="text-gray-600 font-bold text-sm mb-6">Masukkan PIN keamanan</p>
          <input 
            type="password" 
            value={pin} 
            onChange={(e) => setPin(e.target.value)} 
            placeholder="PIN" 
            className="w-full p-4 border-2 border-gray-200 rounded-xl mb-6 text-center text-3xl tracking-[0.5em] font-black text-gray-900 focus:border-blue-600 outline-none transition-all placeholder:font-normal placeholder:tracking-normal" 
          />
          <button type="submit" className="w-full bg-blue-700 text-white font-black py-4 rounded-xl hover:bg-blue-800 transition-transform active:scale-95 shadow-lg shadow-blue-600/30">MASUK DASHBOARD</button>
        </form>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-100 flex font-sans text-gray-900">
      
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <ConfirmModal 
        isOpen={deleteModal.isOpen}
        title="Hapus Data Peserta?"
        message="Hati-hati! Data akan hilang permanen dan kursi akan dikosongkan."
        onConfirm={executeDelete}
        onCancel={() => setDeleteModal({ isOpen: false, regId: null })}
      />

      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-gray-300 fixed h-full hidden md:block z-10 shadow-lg">
        <div className="p-8 border-b border-gray-200">
          <h2 className="text-3xl font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, #2563eb, #9333ea)' }}>ADMIN TK 🎓</h2>
        </div>
        <nav className="p-4 space-y-3 mt-4">
          <button onClick={() => setActiveView('map')} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black transition-all ${activeView === 'map' ? 'bg-blue-700 text-white shadow-lg shadow-blue-600/40' : 'text-gray-600 hover:bg-gray-100 hover:text-black'}`}>
            <span>🗺️</span> Manajemen Peta
          </button>
          <button onClick={() => setActiveView('participants')} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black transition-all ${activeView === 'participants' ? 'bg-blue-700 text-white shadow-lg shadow-blue-600/40' : 'text-gray-600 hover:bg-gray-100 hover:text-black'}`}>
            <span>📋</span> Data Peserta
          </button>
        </nav>
        <div className="absolute bottom-0 w-full p-6 border-t border-gray-200">
          <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-700 font-black py-4 rounded-2xl hover:bg-red-200 transition-colors">
            <span>🚪</span> Keluar
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-72 p-8 overflow-hidden">
        
        {/* Mobile Header */}
        <div className="md:hidden mb-6 flex justify-between items-center bg-white p-4 rounded-2xl shadow-md border border-gray-200">
          <h1 className="text-xl font-black text-blue-700">Admin Panel</h1>
          <div className="flex gap-2">
             <button onClick={() => setActiveView('map')} className={`p-2 rounded-lg text-xs font-black ${activeView === 'map' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>Peta</button>
             <button onClick={() => setActiveView('participants')} className={`p-2 rounded-lg text-xs font-black ${activeView === 'participants' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>Data</button>
          </div>
        </div>

        <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                {activeView === 'map' ? 'Denah Kursi 🏟️' : 'Data Peserta 🧑‍🎓'}
              </h1>
            </div>
            <p className="text-gray-600 font-bold">
              {activeView === 'map' ? 'Klik kursi putih untuk memblokir (rusak/jalur).' : `Total: ${allGroupedList.length} Pendaftar (${occupiedSeats.length} Kursi Terisi)`}
            </p>
          </div>
          
          {activeView === 'participants' && (
             <div className="flex gap-3 w-full md:w-auto">
                <div className="bg-white px-4 py-3 rounded-2xl border-2 border-gray-300 shadow-sm flex items-center gap-3 w-full">
                    <span className="text-gray-500 font-bold">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Cari Nama..." 
                      className="outline-none text-sm font-bold w-full text-gray-800"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* TOMBOL TAMBAH MANUAL */}
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-green-600/30 whitespace-nowrap flex items-center gap-2 transition-transform active:scale-95"
                >
                Tambah
                </button>
                {/* TOMBOL REFRESH DATA (POSISI DI SEBELAH KANAN TOMBOL TAMBAH) */}
                <button 
                  onClick={() => { fetchSeats(); showToast("Data berhasil direfresh!", "success"); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-blue-600/30 whitespace-nowrap flex items-center gap-2 transition-transform active:scale-95"
                >
                Refresh Data
                </button>
             </div>
          )}
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="font-black text-lg">Memuat Data...</p>
          </div>
        ) : (
          <>
            {/* VIEW: PETA */}
            {activeView === 'map' && (
              <div className="w-full overflow-x-auto rounded-3xl shadow-md border border-gray-300 bg-white">
                <div style={{ minWidth: '900px' }} className="p-8"> 
                  <div className="flex justify-center gap-8 mb-10 text-sm bg-gray-100 p-4 rounded-xl mx-auto w-max border-2 border-gray-200">
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-white border-2 border-gray-400 rounded-lg"></div> <span className="font-black text-gray-700">Kosong</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-red-800 rounded-lg border-2 border-red-900"></div> <span className="font-black text-gray-700">Blokir</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-blue-600 rounded-lg border-2 border-blue-800"></div> <span className="font-black text-gray-700">Terisi</span></div>
                  </div>

                  <div className="space-y-3">
                    {rows.map((rowName) => {
                      const seatsInRow = seats.filter(s => s.row_name === rowName);
                      const halfIndex = Math.floor(seatsInRow.length / 2);
                      return (
                        <div key={rowName} className="flex justify-center items-center gap-2">
                          <div className="w-8 font-black text-gray-400 text-xl">{rowName}</div>
                          {seatsInRow.map((seat, index) => {
                            const isAisle = index === halfIndex;
                            return (
                              <button
                                key={seat.id}
                                onClick={() => toggleBlock(seat)}
                                title={seat.registrations ? `${seat.registrations.child_name}` : 'Kosong'}
                                className={`
                                  ${isAisle ? 'ml-14' : ''}
                                  w-10 h-10 rounded-xl text-xs font-black transition-all border-2
                                  ${seat.is_occupied ? 'bg-blue-600 text-white border-blue-800 cursor-not-allowed opacity-100 shadow-md' : ''}
                                  ${seat.is_blocked ? 'bg-red-800 text-white border-red-900 hover:bg-red-700 shadow-md' : ''}
                                  ${!seat.is_occupied && !seat.is_blocked ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100 hover:border-gray-400 hover:scale-110' : ''}
                                `}
                              >
                                {seat.seat_number}
                              </button>
                            );
                          })}
                          <div className="w-8 font-black text-gray-400 text-xl">{rowName}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: DATA PESERTA */}
            {activeView === 'participants' && (
              <div className="bg-white rounded-3xl shadow-md border border-gray-300 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600 uppercase tracking-wider font-black text-xs border-b-2 border-gray-200">
                    <tr>
                      <th className="p-5 pl-8">No Kursi</th>
                      <th className="p-5">Nama Siswa</th>
                      <th className="p-5">Kelas</th>
                      <th className="p-5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredParticipants.map((participant) => (
                      <tr key={participant.regId} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="p-5 pl-8 font-black text-blue-700 text-lg">
                            {participant.seatNumbers.join(" & ")}
                        </td>
                        <td className="p-5 font-bold text-gray-900 capitalize text-base">{participant.childName}</td>
                        <td className="p-5">
                          <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full font-black text-xs border border-blue-200">
                            {participant.childClass}
                          </span>
                        </td>
                        <td className="p-5 flex justify-center gap-3">
                          <button 
                            onClick={() => openEditModal(participant.regId, participant.childName, participant.childClass)}
                            className="bg-yellow-100 text-yellow-800 p-2.5 rounded-xl hover:bg-yellow-200 font-bold transition-colors border border-yellow-200"
                            title="Edit Data"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => confirmDelete(participant.regId)}
                            className="bg-red-100 text-red-800 p-2.5 rounded-xl hover:bg-red-200 font-bold transition-colors border border-red-200"
                            title="Hapus Data"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredParticipants.length === 0 && (
                      <tr><td colSpan={4} className="p-12 text-center text-gray-500 font-bold text-lg">Data tidak ditemukan.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL TAMBAH MANUAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl transform transition-all scale-100 border-4 border-green-500">
            <h3 className="text-2xl font-black text-gray-900 mb-6">Tambah Peserta Manual ➕</h3>
            <p className="text-gray-600 font-semibold mb-4 text-sm bg-green-50 p-3 rounded-lg border border-green-200">
              Sistem akan otomatis mencarikan 2 kursi kosong berurutan.
            </p>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-wider">Nama Siswa</label>
                <input 
                  type="text" 
                  value={addData.name} 
                  onChange={(e) => setAddData({...addData, name: e.target.value})}
                  className="w-full p-4 border-2 border-gray-300 rounded-xl outline-none focus:border-green-500 font-bold text-gray-900 bg-gray-50 focus:bg-white transition-all"
                  placeholder="Masukkan Nama..."
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-wider">Kelas</label>
                <div className="relative">
                  <select 
                    value={addData.class}
                    onChange={(e) => setAddData({...addData, class: e.target.value})}
                    className="w-full p-4 border-2 border-gray-300 rounded-xl outline-none focus:border-green-500 bg-white font-bold text-gray-900 appearance-none"
                  >
                    {["KB B1", "TK A1", "TK A2", "TK A3", "TK A4", "TK B1", "TK B2", "TK B3", "TK B4"].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">Batal</button>
                <button onClick={handleManualAdd} className="flex-1 py-4 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/30 transition-colors">Simpan & Daftar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT */}
      {isEditModalOpen && editData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl transform transition-all scale-100 border-4 border-blue-500">
            <h3 className="text-2xl font-black text-gray-900 mb-6">Edit Data Siswa ✏️</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-wider">Nama Siswa</label>
                <input 
                  type="text" 
                  value={editData.name} 
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="w-full p-4 border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 font-bold text-gray-900 bg-gray-50 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-wider">Kelas</label>
                <div className="relative">
                  <select 
                    value={editData.class}
                    onChange={(e) => setEditData({...editData, class: e.target.value})}
                    className="w-full p-4 border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 bg-white font-bold text-gray-900 appearance-none"
                  >
                    {["KB B1", "TK A1", "TK A2", "TK A3", "TK A4", "TK B1", "TK B2", "TK B3", "TK B4"].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">Batal</button>
                <button onClick={handleSaveEdit} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-colors">Simpan Perubahan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}