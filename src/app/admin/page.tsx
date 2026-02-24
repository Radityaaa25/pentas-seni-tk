"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

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

// --- KOMPONEN TOAST (Tema Coklat) ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border-l-8 animate-slide-in ${type === 'success' ? 'bg-[#fff8e1] border-green-600 text-green-900' : 'bg-[#fff8e1] border-red-600 text-red-900'}`}>
    <span className="text-2xl">{type === 'success' ? '✅' : '❌'}</span>
    <div>
      <h4 className="font-black text-sm uppercase">{type === 'success' ? 'Berhasil' : 'Gagal'}</h4>
      <p className="font-bold text-sm text-[#5d4037]">{message}</p>
    </div>
    <button onClick={onClose} className="ml-4 text-[#8d6e63] hover:text-[#3e2723] font-black">✕</button>
  </div>
);

// --- KOMPONEN MODAL KONFIRMASI ---
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#fff8e1] rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all scale-100 border-4 border-[#8d6e63]">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-200">
          <span className="text-3xl">⚠️</span>
        </div>
        <h3 className="text-xl font-black text-[#3e2723] mb-2">{title}</h3>
        <p className="text-[#5d4037] font-semibold text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-[#d7ccc8] text-[#5d4037] font-bold rounded-xl hover:bg-[#bcaaa4] transition-colors">Batal</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-colors shadow-lg shadow-red-700/30">Ya, Hapus</button>
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
      const { data: existingUsers } = await supabase
        .from('registrations')
        .select('id')
        .ilike('child_name', addData.name)
        .eq('child_class', addData.class)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        showToast("Siswa ini sudah terdaftar!", "error");
        return;
      }

      // HANYA AMBIL DARI ROW D KE ATAS UNTUK REGULER
      const { data: availableSeats } = await supabase
        .from('seats')
        .select('id')
        .eq('is_occupied', false)
        .eq('is_blocked', false)
        .gte('row_name', 'D') 
        .order('row_name', { ascending: true })
        .order('seat_number', { ascending: true })
        .limit(2);

      if (!availableSeats || availableSeats.length < 2) {
        showToast("Kursi penuh! Tidak bisa tambah.", "error");
        return;
      }

      const { data: newRegArray, error: regError } = await supabase
        .from('registrations')
        .insert([{ parent_name: 'Admin Manual', child_name: addData.name, child_class: addData.class }])
        .select();

      if (regError) throw regError;
      if (!newRegArray || newRegArray.length === 0) throw new Error("Gagal insert data.");

      const registration = newRegArray[0];

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
  
  const occupiedSeats = seats.filter(s => s.is_occupied && s.registrations);
  const mapReg = new Map<string, GroupedParticipant>();

  occupiedSeats.forEach(seat => {
    if (!seat.registrations) return;
    const regId = seat.registrations.id;
    const seatLabel = `${seat.row_name}-${seat.seat_number}`;

    if (!mapReg.has(regId)) {
      mapReg.set(regId, {
        regId: regId,
        childName: seat.registrations.child_name,
        childClass: seat.registrations.child_class,
        seatNumbers: []
      });
    }
    mapReg.get(regId)?.seatNumbers.push(seatLabel);
  });

  const allGroupedList = Array.from(mapReg.values());
  const filteredParticipants = allGroupedList.filter(p => 
    p.childName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.seatNumbers.join('').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- LOGIN PAGE ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#2d1b15] flex items-center justify-center p-4 relative font-sans">
        {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
        
        <form onSubmit={handleLogin} className="bg-[#fff8e1] p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center relative overflow-hidden border-4 border-[#5d4037]">
          <div className="absolute top-0 left-0 w-full h-3" style={{ background: 'linear-gradient(to right, #8d6e63, #3e2723)' }}></div>
          
          <div className="flex flex-col items-center justify-center mb-4 mt-4">
             <div className="relative w-24 h-24 mb-2 filter drop-shadow-md">
                <Image src="/TKSD.png" alt="Logo TK" fill className="object-contain"/>
             </div>
             <h1 className="text-3xl font-black text-[#3e2723] mb-1">ADMIN PANEL</h1>
             <p className="text-[#8d6e63] font-bold text-xs uppercase tracking-widest">TK Aisyiyah 21</p>
          </div>

          <p className="text-[#5d4037] font-bold text-sm mb-6">Masukkan PIN keamanan</p>
          <input 
            type="password" 
            value={pin} 
            onChange={(e) => setPin(e.target.value)} 
            placeholder="PIN" 
            className="w-full p-4 border-2 border-[#d7ccc8] bg-[#efebe9] rounded-xl mb-6 text-center text-3xl tracking-[0.5em] font-black text-[#3e2723] focus:border-[#5d4037] outline-none transition-all placeholder:font-normal placeholder:tracking-normal" 
          />
          <button type="submit" className="w-full text-white font-black py-4 rounded-xl transition-transform active:scale-95 shadow-lg shadow-[#3e2723]/30" style={{ background: 'linear-gradient(to right, #6d4c41, #3e2723)' }}>MASUK DASHBOARD</button>
        </form>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen bg-[#efebe9] flex font-sans text-[#3e2723]">
      
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <ConfirmModal 
        isOpen={deleteModal.isOpen}
        title="Hapus Data Peserta?"
        message="Hati-hati! Data akan hilang permanen dan kursi akan dikosongkan."
        onConfirm={executeDelete}
        onCancel={() => setDeleteModal({ isOpen: false, regId: null })}
      />

      {/* SIDEBAR */}
      <aside className="w-72 bg-[#5d4037] border-r border-[#3e2723] fixed h-full hidden md:block z-10 shadow-2xl">
        <div className="p-8 border-b border-[#8d6e63]/30 flex flex-col items-center text-center">
          <div className="relative w-20 h-20 mb-3 filter drop-shadow-md bg-[#fff8e1] rounded-full p-2">
             <Image src="/TKSD.png" alt="Logo" fill className="object-contain p-2"/>
          </div>
          <h2 className="text-2xl font-black text-[#fff8e1]">ADMIN TK</h2>
          <p className="text-[#d7ccc8] text-xs font-bold uppercase tracking-widest mt-1">Panel Kontrol</p>
        </div>
        <nav className="p-4 space-y-3 mt-4">
          <button onClick={() => setActiveView('map')} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black transition-all ${activeView === 'map' ? 'bg-[#fff8e1] text-[#5d4037] shadow-lg' : 'text-[#d7ccc8] hover:bg-[#8d6e63] hover:text-[#fff8e1]'}`}>
            <span>🗺️</span> Manajemen Peta
          </button>
          <button onClick={() => setActiveView('participants')} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black transition-all ${activeView === 'participants' ? 'bg-[#fff8e1] text-[#5d4037] shadow-lg' : 'text-[#d7ccc8] hover:bg-[#8d6e63] hover:text-[#fff8e1]'}`}>
            <span>📋</span> Data Peserta
          </button>
        </nav>
        <div className="absolute bottom-0 w-full p-6 border-t border-[#8d6e63]/30">
          <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center justify-center gap-2 bg-[#3e2723] text-[#fff8e1] font-black py-4 rounded-2xl hover:bg-[#2d1b15] transition-colors border border-[#8d6e63]">
            <span>🚪</span> Keluar
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-72 p-8 overflow-hidden">
        
        {/* Mobile Header */}
        <div className="md:hidden mb-6 flex justify-between items-center bg-[#fff8e1] p-4 rounded-2xl shadow-md border border-[#d7ccc8]">
          <h1 className="text-xl font-black text-[#3e2723]">Admin Panel</h1>
          <div className="flex gap-2">
             <button onClick={() => setActiveView('map')} className={`p-2 rounded-lg text-xs font-black ${activeView === 'map' ? 'bg-[#5d4037] text-white' : 'bg-[#d7ccc8] text-[#5d4037]'}`}>Peta</button>
             <button onClick={() => setActiveView('participants')} className={`p-2 rounded-lg text-xs font-black ${activeView === 'participants' ? 'bg-[#5d4037] text-white' : 'bg-[#d7ccc8] text-[#5d4037]'}`}>Data</button>
          </div>
        </div>

        <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-4xl font-black text-[#3e2723] tracking-tight" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.5)' }}>
                {activeView === 'map' ? 'Denah Kursi 🏟️' : 'Data Peserta 🧑‍🎓'}
              </h1>
            </div>
            <p className="text-[#5d4037] font-bold">
              {activeView === 'map' ? 'Klik kursi putih untuk memblokir (rusak/jalur).' : `Total: ${allGroupedList.length} Pendaftar (${occupiedSeats.length} Kursi Terisi)`}
            </p>
          </div>
          
          {activeView === 'participants' && (
             <div className="flex gap-3 w-full md:w-auto">
                <div className="bg-[#fff8e1] px-4 py-3 rounded-2xl border-2 border-[#d7ccc8] shadow-sm flex items-center gap-3 w-full">
                    <span className="text-[#8d6e63] font-bold">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Cari Nama..." 
                      className="outline-none text-sm font-bold w-full text-[#3e2723] bg-transparent placeholder-[#bcaaa4]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-green-700 hover:bg-green-800 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-green-700/30 whitespace-nowrap flex items-center gap-2 transition-transform active:scale-95"
                >
                Tambah
                </button>
                <button 
                  onClick={() => { fetchSeats(); showToast("Data berhasil direfresh!", "success"); }}
                  className="bg-[#5d4037] hover:bg-[#3e2723] text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-[#3e2723]/30 whitespace-nowrap flex items-center gap-2 transition-transform active:scale-95"
                >
                Refresh
                </button>
             </div>
          )}
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#8d6e63]">
              <div className="w-12 h-12 border-4 border-[#5d4037] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-black text-lg">Memuat Data...</p>
          </div>
        ) : (
          <>
            {activeView === 'map' && (
              <div className="w-full overflow-x-auto rounded-3xl shadow-xl border-4 border-[#8d6e63] bg-[#fff8e1]">
                <div style={{ minWidth: '950px' }} className="p-8"> 
                  
                  {/* LEGEND DIPERBARUI DENGAN VIP DAN PANITIA (B & C) */}
                  <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-10 text-sm bg-[#efebe9] p-4 rounded-xl mx-auto w-max border-2 border-[#d7ccc8]">
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-white border-2 border-[#d7ccc8] rounded-lg"></div> <span className="font-black text-[#5d4037]">Umum</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-[#fff8e1] border-2 border-[#fcd34d] rounded-lg"></div> <span className="font-black text-[#d97706]">VIP (A)</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-[#f3e8ff] border-2 border-[#d8b4fe] rounded-lg"></div> <span className="font-black text-[#7e22ce]">Panitia (B & C)</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-red-800 rounded-lg border-2 border-red-900"></div> <span className="font-black text-[#5d4037]">Blokir</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-[#5d4037] rounded-lg border-2 border-[#3e2723]"></div> <span className="font-black text-[#5d4037]">Terisi</span></div>
                  </div>

                  <div className="space-y-3">
                    {rows.map((rowName) => {
                      const seatsInRow = seats.filter(s => s.row_name === rowName);
                      const halfIndex = Math.floor(seatsInRow.length / 2);
                      
                      // Label Baris diperbarui untuk memasukkan C sebagai Panitia
                      const rowLabel = rowName === 'A' ? 'A (VIP)' : (rowName === 'B' || rowName === 'C') ? `${rowName} (Pan)` : rowName;

                      return (
                        <div key={rowName} className="flex justify-center items-center gap-2">
                          <div className="w-16 text-right font-black text-[#8d6e63] text-sm pr-2">{rowLabel}</div>
                          {seatsInRow.map((seat, index) => {
                            const isAisle = index === halfIndex;
                            
                            // Logika Warna Khusus untuk VIP (A) dan Panitia (B & C)
                            let emptyBgClass = 'bg-white text-[#5d4037] border-[#d7ccc8] hover:bg-[#efebe9] hover:border-[#8d6e63]';
                            if (seat.row_name === 'A') {
                                emptyBgClass = 'bg-[#fff8e1] text-[#d97706] border-[#fcd34d] hover:bg-[#fef3c7] hover:border-[#fbbf24]'; // Emas untuk VIP
                            } else if (seat.row_name === 'B' || seat.row_name === 'C') {
                                emptyBgClass = 'bg-[#f3e8ff] text-[#7e22ce] border-[#d8b4fe] hover:bg-[#e9d5ff] hover:border-[#c084fc]'; // Ungu untuk Panitia
                            }

                            return (
                              <button
                                key={seat.id}
                                onClick={() => toggleBlock(seat)}
                                title={seat.registrations ? `${seat.registrations.child_name}` : 'Kosong'}
                                className={`
                                  ${isAisle ? 'ml-14' : ''}
                                  w-10 h-10 rounded-xl text-xs font-black transition-all border-2
                                  ${seat.is_occupied ? 'bg-[#5d4037] text-white border-[#3e2723] cursor-not-allowed opacity-100 shadow-md' : ''}
                                  ${seat.is_blocked ? 'bg-red-800 text-white border-red-900 hover:bg-red-700 shadow-md' : ''}
                                  ${!seat.is_occupied && !seat.is_blocked ? `${emptyBgClass} hover:scale-110` : ''}
                                `}
                              >
                                {seat.seat_number}
                              </button>
                            );
                          })}
                          <div className="w-16 text-left font-black text-[#8d6e63] text-sm pl-2">{rowLabel}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeView === 'participants' && (
              <div className="bg-[#fff8e1] rounded-3xl shadow-xl border-4 border-[#8d6e63] overflow-hidden">
                <div className="max-h-150 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#5d4037] text-[#fff8e1] uppercase tracking-wider font-black text-xs border-b-4 border-[#3e2723] sticky top-0 z-10">
                      <tr>
                        <th className="p-5 pl-8">No Kursi</th>
                        <th className="p-5">Nama Siswa</th>
                        <th className="p-5">Kelas</th>
                        <th className="p-5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d7ccc8]">
                      {filteredParticipants.map((participant) => (
                        <tr key={participant.regId} className="hover:bg-[#d7ccc8]/30 transition-colors group">
                          <td className="p-5 pl-8 font-black text-[#3e2723] text-lg">
                              {participant.seatNumbers.join(" & ")}
                          </td>
                          <td className="p-5 font-bold text-[#5d4037] capitalize text-base">{participant.childName}</td>
                          <td className="p-5">
                            <span className="bg-[#efebe9] text-[#5d4037] px-4 py-1.5 rounded-full font-black text-xs border border-[#bcaaa4]">
                              {participant.childClass}
                            </span>
                          </td>
                          <td className="p-5 flex justify-center gap-3">
                            <button 
                              onClick={() => openEditModal(participant.regId, participant.childName, participant.childClass)}
                              className="bg-[#ffe082] text-[#e65100] p-2.5 rounded-xl hover:bg-[#ffd54f] font-bold transition-colors border border-[#ffca28]"
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
                        <tr><td colSpan={4} className="p-12 text-center text-[#8d6e63] font-bold text-lg">Data tidak ditemukan.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#fff8e1] p-8 rounded-3xl w-full max-w-md shadow-2xl transform transition-all scale-100 border-4 border-[#5d4037]">
            <h3 className="text-2xl font-black text-[#3e2723] mb-6">Tambah Peserta Manual ➕</h3>
            <p className="text-[#5d4037] font-semibold mb-4 text-sm bg-[#efebe9] p-3 rounded-lg border border-[#d7ccc8]">
              Sistem akan otomatis mencarikan 2 kursi kosong berurutan di area UMUM (Baris D ke atas).
            </p>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-[#8d6e63] uppercase mb-2 tracking-wider">Nama Siswa</label>
                <input 
                  type="text" 
                  value={addData.name} 
                  onChange={(e) => setAddData({...addData, name: e.target.value})}
                  className="w-full p-4 border-2 border-[#d7ccc8] rounded-xl outline-none focus:border-[#5d4037] font-bold text-[#3e2723] bg-white focus:bg-white transition-all"
                  placeholder="Masukkan Nama..."
                />
              </div>
              <div>
                <label className="block text-xs font-black text-[#8d6e63] uppercase mb-2 tracking-wider">Kelas</label>
                <div className="relative">
                  <select 
                    value={addData.class}
                    onChange={(e) => setAddData({...addData, class: e.target.value})}
                    className="w-full p-4 border-2 border-[#d7ccc8] rounded-xl outline-none focus:border-[#5d4037] bg-white font-bold text-[#3e2723] appearance-none"
                  >
                    {["KB B1", "TK A1", "TK A2", "TK A3", "TK A4", "TK B1", "TK B2", "TK B3", "TK B4"].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8d6e63]">▼</div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-[#d7ccc8] text-[#5d4037] font-bold rounded-xl hover:bg-[#bcaaa4] transition-colors">Batal</button>
                <button onClick={handleManualAdd} className="flex-1 py-4 bg-green-700 text-white font-black rounded-xl hover:bg-green-800 shadow-lg shadow-green-700/30 transition-colors">Simpan & Daftar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#fff8e1] p-8 rounded-3xl w-full max-w-md shadow-2xl transform transition-all scale-100 border-4 border-[#8d6e63]">
            <h3 className="text-2xl font-black text-[#3e2723] mb-6">Edit Data Siswa ✏️</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-[#8d6e63] uppercase mb-2 tracking-wider">Nama Siswa</label>
                <input 
                  type="text" 
                  value={editData.name} 
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="w-full p-4 border-2 border-[#d7ccc8] rounded-xl outline-none focus:border-[#5d4037] font-bold text-[#3e2723] bg-white focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-[#8d6e63] uppercase mb-2 tracking-wider">Kelas</label>
                <div className="relative">
                  <select 
                    value={editData.class}
                    onChange={(e) => setEditData({...editData, class: e.target.value})}
                    className="w-full p-4 border-2 border-[#d7ccc8] rounded-xl outline-none focus:border-[#5d4037] bg-white font-bold text-[#3e2723] appearance-none"
                  >
                    {["KB B1", "TK A1", "TK A2", "TK A3", "TK A4", "TK B1", "TK B2", "TK B3", "TK B4"].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8d6e63]">▼</div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-[#d7ccc8] text-[#5d4037] font-bold rounded-xl hover:bg-[#bcaaa4] transition-colors">Batal</button>
                <button onClick={handleSaveEdit} className="flex-1 py-4 bg-[#5d4037] text-white font-black rounded-xl hover:bg-[#3e2723] shadow-lg shadow-[#3e2723]/30 transition-colors">Simpan Perubahan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}