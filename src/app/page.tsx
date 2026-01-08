"use client";
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';

export default function Home() {
  const router = useRouter();
  const ticketRef = useRef<HTMLDivElement>(null); 
  
  const [activeTab, setActiveTab] = useState<'daftar' | 'cek'>('daftar');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [finalSeats, setFinalSeats] = useState<string[]>([]);
  const [regId, setRegId] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState('');

  const [formData, setFormData] = useState({ childName: '', childClass: 'KB B1' });
  const [searchName, setSearchName] = useState('');

  const classOptions = ["KB B1", "TK A1", "TK A2", "TK A3", "TK A4", "TK B1", "TK B2", "TK B3", "TK B4"];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const downloadTicketAsImage = async () => {
    if (!ticketRef.current) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `Tiket-TK21-${formData.childName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal download:", err);
    }
  };

  const handleAutoAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const { data: existingUser } = await supabase.from('registrations').select('id').ilike('child_name', formData.childName).eq('child_class', formData.childClass).single();
      if (existingUser) {
        setStatus("Nama & Kelas ini sudah terdaftar! Gunakan menu 'Cek Tiket'.");
        setLoading(false);
        return;
      }

      const { data: availableSeats, error: searchError } = await supabase
        .from('seats')
        .select('id, row_name, seat_number')
        .eq('is_occupied', false)
        .eq('is_blocked', false) 
        .order('row_name', { ascending: true }) 
        .order('seat_number', { ascending: true }) 
        .limit(2);

      if (searchError) throw searchError;
      if (!availableSeats || availableSeats.length < 2) {
        setStatus("Kursi penuh atau tidak cukup! 😭");
        setLoading(false);
        return;
      }

      const { data: registration, error: regError } = await supabase
        .from('registrations')
        .insert([{ parent_name: '-', child_name: formData.childName, child_class: formData.childClass }])
        .select().single();

      if (regError) throw regError;

      const seatIds = availableSeats.map(seat => seat.id);
      const { error: updateError } = await supabase.from('seats').update({ is_occupied: true, assigned_to: registration.id }).in('id', seatIds);
      if (updateError) throw updateError;

      setFinalSeats(seatIds);
      setRegId(registration.id);
      setShowSuccessPopup(true);
      setTimeout(() => { downloadTicketAsImage(); }, 1000); 
      
    } catch (error) {
       let msg = "Terjadi Kesalahan";
       if (error instanceof Error) msg = error.message;
       setStatus(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const { data, error } = await supabase.from('registrations').select('id, child_name').ilike('child_name', `%${searchName}%`).limit(1).single();
      if (error || !data) {
        setStatus("Data tidak ditemukan.");
        setLoading(false);
        return;
      }
      router.push(`/ticket?id=${data.id}`);
    } catch (error) { 
      console.error(error);
      setStatus("Gagal mencari data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Background: Gradient Cream ke Kuning Lembut (Tidak Silau)
    <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      
      {/* Dekorasi Background Blob (Warna Pastel) */}
      {/* Perbaikan: Menggunakan class standar Tailwind (-top-12, -left-12, dll) */}
      <div className="absolute -top-12 -left-12 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob"></div>
      <div className="absolute -bottom-12 -right-12 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/3 left-1/4 w-60 h-60 bg-red-100 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-4000"></div>

      {/* POPUP SUKSES */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          {/* Perbaikan: rounded-3xl */}
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-white animate-bounce-in relative">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Pendaftaran Berhasil!</h2>
            <p className="text-gray-500 mb-6 font-medium text-sm">Tiket sedang didownload...</p>
            
            <div className="bg-orange-50 p-6 rounded-2xl mb-6 border border-orange-100">
              <p className="text-xs text-orange-600 uppercase font-bold tracking-widest mb-1">Nomor Kursi</p>
              <p className="text-4xl font-black text-orange-600 tracking-tighter">{finalSeats.join(" & ")}</p>
            </div>

            <button 
              onClick={() => router.push(`/ticket?id=${regId}`)} 
              className="w-full text-white font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 hover:brightness-110"
              style={{ background: 'linear-gradient(to right, #f97316, #ea580c)' }}
            >
              Lihat Peta Lokasi 🗺️
            </button>
          </div>
        </div>
      )}

      {/* --- HIDDEN TICKET (Untuk Cetak - Background Putih agar bersih saat diprint/save) --- */}
      <div className="absolute -z-50 opacity-0 pointer-events-none top-0 left-0">
        <div ref={ticketRef} style={{ width: '400px', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '20px', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(to right, #f97316, #ea580c)', padding: '24px', textAlign: 'center', color: 'white' }}>
             <h1 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '1px', margin: 0 }}>TIKET MASUK</h1>
             <p style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9, marginTop: '4px' }}>Pentas Seni 2026</p>
             <p style={{ fontSize: '10px', fontWeight: 500, opacity: 0.8 }}>TK Aisyiyah 21 Rawamangun</p>
          </div>
          
          <div style={{ padding: '32px', textAlign: 'center' }}>
             <p style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Nama Siswa</p>
             <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#1f2937', margin: '4px 0 20px 0', textTransform: 'capitalize' }}>{formData.childName}</h2>
             <div style={{ width: '100%', height: '2px', background: '#f3f4f6', margin: '20px 0' }}></div>
             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px' }}>
                <div style={{ textAlign: 'left' }}><p style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Kelas</p><p style={{ fontSize: '18px', fontWeight: 700, color: '#f97316' }}>{formData.childClass}</p></div>
                <div style={{ textAlign: 'right' }}><p style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Nomor Kursi</p><p style={{ fontSize: '22px', fontWeight: 900, color: '#f97316' }}>{finalSeats.join(" & ")}</p></div>
             </div>
          </div>

          <div style={{ background: '#f9fafb', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '1px solid #f3f4f6' }}>
             <div style={{ background: 'white', padding: '10px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
               {regId && baseUrl && <QRCodeSVG value={`${baseUrl}/ticket?id=${regId}`} size={90} level={"H"} fgColor="#1f2937" />}
             </div>
             <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '12px', fontWeight: 500 }}>Scan QR Code untuk melihat denah lokasi</p>
          </div>
        </div>
      </div>

      {/* --- FORM UTAMA --- */}
      {/* Perbaikan: rounded-3xl (standard class) */}
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl w-full max-w-md shadow-xl border border-white relative z-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-orange-100 rounded-full mb-3 text-2xl shadow-inner">🎨</div>
          <h1 className="text-2xl font-black text-gray-800 mb-1">Pentas Seni 2026</h1>
          <p className="text-gray-500 font-medium text-sm">TK Aisyiyah 21 Rawamangun</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
          <button 
            onClick={() => { setActiveTab('daftar'); setStatus(null); }} 
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'daftar' ? 'bg-white text-orange-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Daftar Baru
          </button>
          <button 
            onClick={() => { setActiveTab('cek'); setStatus(null); }} 
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'cek' ? 'bg-white text-orange-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Cek Tiket
          </button>
        </div>

        {status && <div className={`p-4 mb-6 rounded-xl text-center text-sm font-bold animate-pulse ${status.includes('maaf') || status.includes('terdaftar') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>{status}</div>}

        {activeTab === 'daftar' ? (
          <form onSubmit={handleAutoAssign} className="space-y-5">
            <div>
              <label className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Nama Lengkap Anak</label>
              <input 
                type="text" 
                required 
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-400 rounded-2xl outline-none text-gray-800 font-bold transition-all placeholder:text-gray-400" 
                placeholder="Contoh: Budi Santoso" 
                onChange={(e) => setFormData({...formData, childName: e.target.value})} 
              />
            </div>
            
            <div className="relative">
              <label className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Pilih Kelas</label>
              <button 
                type="button" 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-400 rounded-2xl text-left flex justify-between items-center outline-none transition-all"
              >
                <span className="text-gray-800 font-bold">{formData.childClass}</span>
                <span className="text-gray-400">▼</span>
              </button>
              
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden p-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {classOptions.map((option) => (
                      <div 
                        key={option} 
                        onClick={() => { setFormData({ ...formData, childClass: option }); setIsDropdownOpen(false); }} 
                        className={`p-3 rounded-xl cursor-pointer font-bold text-sm mb-1 transition-colors ${formData.childClass === option ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-50'}`}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full text-white font-bold py-4 rounded-2xl shadow-xl shadow-orange-500/20 mt-4 flex justify-center items-center gap-2 text-lg transform transition active:scale-95 hover:brightness-110"
              style={{ background: 'linear-gradient(to right, #f97316, #ea580c)' }}
            >
              {loading ? <span className="animate-pulse">Sedang Memproses...</span> : <span>Dapatkan Kursi 🎟️</span>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCheckTicket} className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-sm text-blue-800 font-medium">
              Lupa nomor bangku? Masukkan nama anak di bawah ini untuk melihat tiket kembali.
            </div>
            <div>
              <label className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Cari Nama Anak</label>
              <input type="text" required className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-400 rounded-2xl outline-none text-gray-800 font-bold transition-all" placeholder="Nama..." onChange={(e) => setSearchName(e.target.value)} />
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-500/20 mt-4 transform transition active:scale-95 hover:brightness-110"
              style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)' }}
            >
              {loading ? <span>Mencari...</span> : <span>Cek Tiket Saya 🔍</span>}
            </button>
          </form>
        )}
      </div>
      
      <div className="fixed bottom-4 text-center w-full text-gray-400 text-[10px] font-medium tracking-widest uppercase opacity-60">
        © 2026 TK Aisyiyah 21 Rawamangun
      </div>
    </div>
  );
}