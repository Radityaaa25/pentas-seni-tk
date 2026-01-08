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
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [finalSeats, setFinalSeats] = useState<string[]>([]);
  const [regId, setRegId] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState('');

  const [formData, setFormData] = useState({ childName: '', childClass: 'KB B1' });
  const [searchData, setSearchData] = useState({ childName: '', childClass: 'KB B1' });

  const classOptions = ["KB B1", "TK A1", "TK A2", "TK A3", "TK A4", "TK B1", "TK B2", "TK B3", "TK B4"];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const downloadTicketAsImage = async () => {
    if (!ticketRef.current) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 4 });
      const link = document.createElement("a");
      link.download = `VIP-Ticket-${formData.childName}.png`;
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
      const { data, error } = await supabase
        .from('registrations')
        .select('id, child_name')
        .ilike('child_name', `%${searchData.childName}%`)
        .eq('child_class', searchData.childClass)
        .limit(1)
        .single();

      if (error || !data) {
        setStatus("Data tidak ditemukan. Cek ejaan nama dan kelas.");
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
    // PERBAIKAN: Tambahkan 'overflow-x-hidden' di sini
    <div 
      className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-x-hidden"
      style={{ background: 'linear-gradient(to bottom right, #fff7ed, #fffbeb, #fefce8)' }}
    >
      
      <div className="absolute -top-12 -left-12 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob"></div>
      <div className="absolute -bottom-12 -right-12 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/3 left-1/4 w-60 h-60 bg-red-100 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-4000"></div>

      {showSuccessPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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

      {/* --- HIDDEN TICKET (PREMIUM STUB DESIGN) --- */}
      <div className="absolute -z-50 opacity-0 pointer-events-none top-0 left-0">
        <div ref={ticketRef} style={{ 
          width: '600px', 
          background: '#111827', 
          padding: '20px',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ 
            background: 'white', 
            display: 'flex', 
            borderRadius: '24px', 
            overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{ flex: 1, padding: '40px', position: 'relative', borderRight: '3px dashed #f3f4f6' }}>
               <div style={{ position: 'absolute', top: '-100px', left: '-50px', fontSize: '200px', fontWeight: 900, color: '#f9fafb', zIndex: 0 }}>21</div>
               <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#ea580c', letterSpacing: '4px', marginBottom: '10px' }}>ADMISSION TICKET</p>
                  <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#111827', lineHeight: 1, margin: '0 0 40px 0' }}>PENTAS SENI<br/>2026</h1>
                  <div style={{ marginBottom: '30px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '5px' }}>Guest Name</p>
                    <p style={{ fontSize: '32px', fontWeight: 900, color: '#111827', textTransform: 'capitalize' }}>{formData.childName}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '40px' }}>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Class</p>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: '#111827' }}>{formData.childClass}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Hall</p>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: '#111827' }}>AUDITORIUM</p>
                    </div>
                  </div>
               </div>
               <div style={{ position: 'absolute', bottom: '80px', right: '-15px', width: '30px', height: '30px', background: '#111827', borderRadius: '50%' }}></div>
               <div style={{ position: 'absolute', top: '80px', right: '-15px', width: '30px', height: '30px', background: '#111827', borderRadius: '50%' }}></div>
            </div>
            <div style={{ width: '200px', background: '#ea580c', padding: '40px 20px', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
               <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', marginBottom: '10px' }}>SEAT NO.</p>
                  <h2 style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1, margin: 0 }}>{finalSeats.join("/")}</h2>
               </div>
               <div style={{ background: 'white', padding: '10px', borderRadius: '16px' }}>
                  {regId && baseUrl && <QRCodeSVG value={`${baseUrl}/ticket?id=${regId}`} size={100} level={"H"} fgColor="#ea580c" />}
               </div>
               <p style={{ fontSize: '10px', fontWeight: 700, opacity: 0.8, textAlign: 'center' }}>TK AISYIYAH 21<br/>RAWAMANGUN</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl p-8 rounded-4xl w-full max-w-md shadow-2xl shadow-orange-100 border border-white relative z-10">
        <div className="text-center mb-8 relative">
          <div className="flex justify-center mb-4 relative h-20">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-orange-300/30 rounded-full blur-xl animate-pulse"></div>
             <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-yellow-300/50 rounded-full blur-lg"></div>
             <div className="relative z-10 flex items-center justify-center gap-1">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-500 animate-bounce delay-100">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                 </svg>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-orange-600 -rotate-12">
                    <path fillRule="evenodd" d="M19.957 4.297a.75.75 0 00-1.263-.636 3.003 3.003 0 01-3.352.82L10.5 2.223v10.233a4.486 4.486 0 00-1.313-.337C6.544 11.885 4.5 13.29 4.5 15.023c0 1.734 2.044 3.138 4.687 3.138 2.643 0 4.687-1.404 4.687-3.138V6.946l4.266 1.756a.75.75 0 001.044-.677V4.297z" clipRule="evenodd" />
                 </svg>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-orange-400 animate-pulse">
                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6 20.25a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 016 20.25z" clipRule="evenodd" />
                 </svg>
             </div>
          </div>
          <h1 className="text-2xl font-black text-gray-800 mb-1 tracking-tight relative z-10">Pentas Seni 2026</h1>
          <p className="text-gray-500 font-bold text-sm uppercase tracking-wide relative z-10">TK Aisyiyah 21 Rawamangun</p>
        </div>

        <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
          <button onClick={() => { setActiveTab('daftar'); setStatus(null); }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'daftar' ? 'bg-white text-orange-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Daftar Baru</button>
          <button onClick={() => { setActiveTab('cek'); setStatus(null); }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'cek' ? 'bg-white text-orange-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Cek Tiket</button>
        </div>

        {status && <div className={`p-4 mb-6 rounded-xl text-center text-sm font-bold animate-pulse ${status.includes('maaf') || status.includes('terdaftar') || status.includes('tidak ditemukan') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>{status}</div>}

        {activeTab === 'daftar' ? (
          <form onSubmit={handleAutoAssign} className="space-y-5">
            <div>
              <label className="block text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Nama Lengkap Anak</label>
              <input type="text" required className="w-full p-4 bg-gray-50 border-2 border-gray-100 focus:bg-white focus:border-orange-400 rounded-2xl outline-none text-gray-800 font-bold transition-all placeholder:text-gray-400" placeholder="Contoh: Budi Santoso" onChange={(e) => setFormData({...formData, childName: e.target.value})} />
            </div>
            <div className="relative">
              <label className="block text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Pilih Kelas</label>
              <button type="button" onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 focus:bg-white focus:border-orange-400 rounded-2xl text-left flex justify-between items-center outline-none transition-all">
                <span className="text-gray-800 font-bold">{formData.childClass}</span>
                <span className="text-gray-400">▼</span>
              </button>
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden p-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {classOptions.map((option) => (
                      <div key={option} onClick={() => { setFormData({ ...formData, childClass: option }); setIsDropdownOpen(false); }} className={`p-3 rounded-xl cursor-pointer font-bold text-sm mb-1 transition-colors ${formData.childClass === option ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-50'}`}>
                        {option}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button type="submit" disabled={loading} className="w-full text-white font-bold py-4 rounded-2xl shadow-xl shadow-orange-500/20 mt-4 flex justify-center items-center gap-3 text-lg transform transition active:scale-95 hover:brightness-110 group" style={{ background: 'linear-gradient(to right, #f97316, #ea580c)' }}>
              {loading ? (
                <span className="animate-pulse">Sedang Memproses...</span>
              ) : (
                <>
                  <span>Dapatkan Kursi</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-orange-100 transition-transform group-hover:scale-110 group-hover:rotate-6">
                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94c-.924-.499-1.5-1.466-1.5-2.56 0-1.094.576-2.06 1.5-2.56V9c-.924-.499-1.5-1.466-1.5-2.56 0-1.094.576-2.06 1.5-2.56V3.75a.75.75 0 00-.75-.75H3.75a.75.75 0 00-.75.75v1.94c.924.499 1.5 1.466 1.5 2.56 0 1.094-.576 2.06-1.5 2.56v1.94c.924.499 1.5 1.466 1.5 2.56 0 1.094-.576 2.06-1.5 2.56z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCheckTicket} className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-sm text-blue-800 font-medium">Lupa nomor bangku? Cari data berdasarkan Nama & Kelas.</div>
            
            <div>
              <label className="block text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Cari Nama Anak</label>
              <input type="text" required className="w-full p-4 bg-gray-50 border-2 border-gray-100 focus:bg-white focus:border-blue-400 rounded-2xl outline-none text-gray-800 font-bold transition-all" placeholder="Nama..." onChange={(e) => setSearchData({...searchData, childName: e.target.value})} />
            </div>

            <div className="relative">
              <label className="block text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Cari Kelas</label>
              <button type="button" onClick={() => setIsSearchDropdownOpen(!isSearchDropdownOpen)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 focus:bg-white focus:border-blue-400 rounded-2xl text-left flex justify-between items-center outline-none transition-all">
                <span className="text-gray-800 font-bold">{searchData.childClass}</span>
                <span className="text-gray-400">▼</span>
              </button>
              {isSearchDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsSearchDropdownOpen(false)}></div>
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden p-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {classOptions.map((option) => (
                      <div key={option} onClick={() => { setSearchData({ ...searchData, childClass: option }); setIsSearchDropdownOpen(false); }} className={`p-3 rounded-xl cursor-pointer font-bold text-sm mb-1 transition-colors ${searchData.childClass === option ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-blue-50'}`}>
                        {option}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-500/20 mt-4 flex justify-center items-center gap-3 transform transition active:scale-95 hover:brightness-110 group" style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
              {loading ? (
                <span>Mencari...</span>
              ) : (
                <>
                  <span>Cek Tiket Saya</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-blue-100 transition-transform group-hover:scale-110 group-hover:-rotate-6">
                    <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
          </form>
        )}
      </div>
      <div className="fixed bottom-4 text-center w-full text-gray-400 text-[10px] font-medium tracking-widest uppercase opacity-60">© 2026 TK Aisyiyah 21 Rawamangun</div>
    </div>
  );
}