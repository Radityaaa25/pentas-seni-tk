"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';

export default function Home() {
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

  const downloadTicketAsImage = useCallback(async () => {
    if (!ticketRef.current) return;
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 4 });
      const link = document.createElement("a");
      link.download = `VIP-Ticket-${formData.childName || 'Tiket'}.png`; 
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal download:", err);
    }
  }, [formData.childName]); 

  useEffect(() => {
    if (showSuccessPopup && finalSeats.length > 0) {
        const timer = setTimeout(() => {
            downloadTicketAsImage();
        }, 1000); 
        return () => clearTimeout(timer);
    }
  }, [showSuccessPopup, finalSeats, downloadTicketAsImage]);

  const handleAutoAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    // 1. Cek apakah Nama Kosong
    if (!formData.childName || formData.childName.trim() === '') {
        setStatus("Nama anak wajib diisi!");
        setLoading(false);
        return;
    }

    try {
      // 2. Cek Duplikasi
      const { data: existingUsers } = await supabase
        .from('registrations')
        .select('id')
        .ilike('child_name', formData.childName.trim())
        .eq('child_class', formData.childClass)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        // --- PERBAIKAN: HANYA TAMPILKAN STATUS, JANGAN REDIRECT ---
        setStatus("Nama & Kelas ini sudah terdaftar! Gunakan menu 'Cek Tiket' jika ingin melihat tiket.");
        setLoading(false);
        return; // Berhenti di sini
      }

      // 3. Cari Kursi Kosong (Row D keatas)
      const { data: availableSeats, error: searchError } = await supabase
        .from('seats')
        .select('id, row_name, seat_number')
        .eq('is_occupied', false)
        .eq('is_blocked', false)
        .gte('row_name', 'D') 
        .order('row_name', { ascending: true }) 
        .order('seat_number', { ascending: true }) 
        .limit(2);

      if (searchError) throw searchError;

      if (!availableSeats || availableSeats.length === 0) {
        setStatus("Mohon maaf, kursi umum (Row D-L) sudah penuh! 😭");
        setLoading(false);
        return;
      }

      // 4. Insert Data Pendaftar
      const { data: newRegArray, error: regError } = await supabase
        .from('registrations')
        .insert([{ parent_name: '-', child_name: formData.childName.trim(), child_class: formData.childClass }])
        .select();

      if (regError) throw regError;
      if (!newRegArray || newRegArray.length === 0) throw new Error("Gagal menyimpan data.");

      const registration = newRegArray[0];

      // 5. Update Status Kursi
      const seatIds = availableSeats.map(seat => seat.id);
      const readableSeatNames = availableSeats.map(seat => `${seat.row_name}-${seat.seat_number}`);

      const { error: updateError } = await supabase.from('seats').update({ is_occupied: true, assigned_to: registration.id }).in('id', seatIds);
      if (updateError) throw updateError;

      setFinalSeats(readableSeatNames); 
      setRegId(registration.id);
      
      setShowSuccessPopup(true);
      setLoading(false);
      
    } catch (error) {
       let msg = "Terjadi Kesalahan";
       if (error instanceof Error) msg = error.message;
       console.error(error);
       setStatus(`Error: ${msg}`);
       setLoading(false);
    }
  };

  const handleCheckTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    
    if (!searchData.childName.trim()) {
        setStatus("Masukkan nama yang ingin dicari.");
        setLoading(false);
        return;
    }

    const namaClean = searchData.childName.trim();
    
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('id, child_name')
        .ilike('child_name', `%${namaClean}%`)
        .eq('child_class', searchData.childClass)
        .limit(1);

      if (error) {
        setStatus("Gagal menghubungi server.");
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setStatus("Data tidak ditemukan. Cek ejaan nama.");
        setLoading(false);
        return;
      }

      const targetId = data[0].id;
      window.location.href = `/ticket?id=${targetId}`;

    } catch (error) { 
      console.error(error);
      setStatus("Gagal mencari data.");
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-x-hidden"
      style={{ 
        backgroundImage: "url('/Background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>

      {showSuccessPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#fff8e1] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-[#8d6e63] animate-pop-in relative">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-2xl font-black text-[#5d4037] mb-2">Pendaftaran Berhasil!</h2>
            <p className="text-[#8d6e63] mb-6 font-medium text-sm">Tiket sedang didownload...</p>
            
            <div className="bg-[#efebe9] p-6 rounded-2xl mb-6 border border-[#d7ccc8]">
              <p className="text-xs text-[#5d4037] uppercase font-bold tracking-widest mb-1">Nomor Kursi</p>
              <p className="text-4xl font-black text-[#3e2723] tracking-tighter">{finalSeats.join(" & ")}</p>
            </div>

            <button 
              onClick={() => {
                if (regId) {
                   window.location.href = `/ticket?id=${regId}`;
                } else {
                   alert("ID tidak ditemukan. Silakan refresh.");
                }
              }} 
              className="w-full text-white font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 hover:brightness-110 cursor-pointer"
              style={{ background: 'linear-gradient(to right, #8d6e63, #5d4037)' }}
            >
              Lihat Peta Lokasi 🗺️
            </button>
          </div>
        </div>
      )}

      {/* --- HIDDEN TICKET STUB (Untuk Download) --- */}
      <div className="absolute -z-50 opacity-0 pointer-events-none top-0 left-0">
        <div ref={ticketRef} style={{ width: '600px', background: '#1c1917', padding: '20px', fontFamily: 'sans-serif' }}>
          <div style={{ 
            backgroundImage: "url('/Background.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex', 
            borderRadius: '24px', 
            overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
            border: '4px solid #5d4037'
          }}>
            <div style={{ flex: 1, padding: '40px', position: 'relative', borderRight: '3px dashed #5d4037' }}>
               <div style={{ position: 'absolute', top: '-100px', left: '-50px', fontSize: '200px', fontWeight: 900, color: '#3e2723', opacity: 0.1, zIndex: 0 }}>21</div>
               <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#5d4037', letterSpacing: '4px', marginBottom: '10px' }}>ADMISSION TICKET</p>
                  <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#3e2723', lineHeight: 1, margin: '0 0 40px 0', textShadow: '1px 1px 0px rgba(255,255,255,0.4)' }}>PENTAS SENI<br/>2026</h1>
                  <div style={{ marginBottom: '30px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#8d6e63', textTransform: 'uppercase', marginBottom: '5px' }}>Guest Name</p>
                    <p style={{ fontSize: '32px', fontWeight: 900, color: '#3e2723', textTransform: 'capitalize' }}>{formData.childName}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '40px' }}>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#8d6e63', textTransform: 'uppercase' }}>Class</p>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: '#3e2723' }}>{formData.childClass}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#8d6e63', textTransform: 'uppercase' }}>Hall</p>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: '#3e2723' }}>AUDITORIUM</p>
                    </div>
                  </div>
               </div>
               <div style={{ position: 'absolute', bottom: '80px', right: '-15px', width: '30px', height: '30px', background: '#1c1917', borderRadius: '50%', border: '4px solid #5d4037' }}></div>
               <div style={{ position: 'absolute', top: '80px', right: '-15px', width: '30px', height: '30px', background: '#1c1917', borderRadius: '50%', border: '4px solid #5d4037' }}></div>
            </div>

            <div style={{ width: '200px', background: '#5d4037', padding: '40px 20px', color: '#efebe9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', borderLeft: '3px dashed #8d6e63' }}>
               <div style={{ textAlign: 'center', width: '100%' }}>
                  <p style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', marginBottom: '10px', color: '#d7ccc8' }}>SEAT NO.</p>
                  <h2 style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1.1, margin: 0, color: '#ffffff' }}>{finalSeats.join("/")}</h2>
               </div>
               <div style={{ background: '#fff8e1', padding: '10px', borderRadius: '16px' }}>
                  {regId && baseUrl && <QRCodeSVG value={`${baseUrl}/ticket?id=${regId}`} size={100} level={"H"} fgColor="#3e2723" bgColor="#fff8e1" />}
               </div>
               <p style={{ fontSize: '10px', fontWeight: 700, opacity: 0.8, textAlign: 'center', color: '#d7ccc8' }}>TK AISYIYAH 21<br/>RAWAMANGUN</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- FORM CONTAINER --- */}
      <div 
        className="w-full max-w-md p-8 md:p-12 relative z-10 mx-auto animate-fade-in-up"
        style={{ 
          backgroundImage: "url('/ConForm.png')",
          backgroundSize: '100% 100%', 
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.25))' 
        }}
      >
        <div className="text-center mb-6 relative">
          <div className="flex justify-center mb-4">
             <div className="relative w-28 h-28 filter drop-shadow-md transition-transform hover:scale-110 duration-500 animate-float">
                <Image 
                  src="/TKSD.png" 
                  alt="Logo TK Aisyiyah" 
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                />
             </div>
          </div>
          <div className="animate-fade-in-up delay-100">
            <h1 className="text-2xl font-black text-[#3e2723] mb-1 tracking-tight relative z-10" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.5)' }}>Pentas Seni 2026</h1>
            <p className="text-[#5d4037] font-bold text-sm uppercase tracking-wide relative z-10">TK Aisyiyah 21 Rawamangun</p>
          </div>
        </div>

        <div className="flex bg-[#d7ccc8]/50 p-1.5 rounded-2xl mb-6 backdrop-blur-sm border border-[#a1887f]/30 animate-fade-in-up delay-200">
          <button 
            onClick={() => { setActiveTab('daftar'); setStatus(null); }} 
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'daftar' 
              ? 'bg-[#5d4037] text-white shadow-md transform scale-100' 
              : 'text-[#5d4037] hover:bg-[#a1887f]/20 hover:scale-95'
            }`}
          >
            Daftar Baru
          </button>
          <button 
            onClick={() => { setActiveTab('cek'); setStatus(null); }} 
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'cek' 
              ? 'bg-[#5d4037] text-white shadow-md transform scale-100' 
              : 'text-[#5d4037] hover:bg-[#a1887f]/20 hover:scale-95'
            }`}
          >
            Cek Tiket
          </button>
        </div>

        {status && (
          <div className={`p-4 mb-6 rounded-xl text-center text-sm font-bold animate-pulse ${
            status.includes('maaf') || status.includes('terdaftar') || status.includes('tidak ditemukan') || status.includes('Gagal') || status.includes('penuh')
            ? 'bg-red-100 text-red-800 border border-red-200' 
            : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {status}
          </div>
        )}

        <div className="animate-fade-in-up delay-300">
          {activeTab === 'daftar' ? (
            <form onSubmit={handleAutoAssign} className="space-y-5">
              <div className="group">
                <label className="block text-[#5d4037] text-[10px] font-black uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-[#8d6e63]">Nama Lengkap Anak</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-4 bg-[#fff8e1]/80 border-2 border-[#d7ccc8] focus:bg-white focus:border-[#8d6e63] focus:ring-4 focus:ring-[#8d6e63]/20 rounded-2xl outline-none text-[#3e2723] font-bold transition-all duration-300 placeholder:text-[#a1887f]" 
                  placeholder="Contoh: Budi Santoso" 
                  value={formData.childName} // Binding Value
                  onChange={(e) => setFormData({...formData, childName: e.target.value})} 
                />
              </div>
              <div className="relative group">
                <label className="block text-[#5d4037] text-[10px] font-black uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-[#8d6e63]">Pilih Kelas</label>
                <button 
                  type="button" 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                  className="w-full p-4 bg-[#fff8e1]/80 border-2 border-[#d7ccc8] focus:bg-white focus:border-[#8d6e63] focus:ring-4 focus:ring-[#8d6e63]/20 rounded-2xl text-left flex justify-between items-center outline-none transition-all duration-300 text-[#3e2723]"
                >
                  <span className="font-bold">{formData.childClass}</span>
                  <span className={`text-[#8d6e63] transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                    <div className="absolute left-0 right-0 top-full mt-2 bg-[#fff8e1] border border-[#d7ccc8] rounded-2xl shadow-xl z-20 overflow-hidden p-2 max-h-56 overflow-y-auto custom-scrollbar animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
                      {classOptions.map((option) => (
                        <div 
                          key={option} 
                          onClick={() => { setFormData({ ...formData, childClass: option }); setIsDropdownOpen(false); }} 
                          className={`p-3 rounded-xl cursor-pointer font-bold text-sm mb-1 transition-colors ${
                            formData.childClass === option 
                            ? 'bg-[#5d4037] text-white' 
                            : 'text-[#5d4037] hover:bg-[#d7ccc8]'
                          }`}
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
                className="w-full text-white font-bold py-4 rounded-2xl shadow-xl shadow-[#3e2723]/20 mt-4 flex justify-center items-center gap-3 text-lg transform transition-all duration-300 active:scale-95 hover:brightness-110 hover:shadow-2xl group" 
                style={{ background: 'linear-gradient(to right, #6d4c41, #3e2723)' }}
              >
                {loading ? (
                  <span className="animate-pulse">Sedang Memproses...</span>
                ) : (
                  <>
                    <span>Dapatkan Kursi</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-[#d7ccc8] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1">
                      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94c-.924-.499-1.5-1.466-1.5-2.56 0-1.094.576-2.06 1.5-2.56V9c-.924-.499-1.5-1.466-1.5-2.56 0-1.094.576-2.06 1.5-2.56V3.75a.75.75 0 00-.75-.75H3.75a.75.75 0 00-.75.75v1.94c.924.499 1.5 1.466 1.5 2.56 0 1.094-.576 2.06-1.5 2.56z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCheckTicket} className="space-y-6">
              <div className="bg-[#a1887f]/10 p-4 rounded-2xl border border-[#a1887f]/30 text-sm text-[#3e2723] font-medium">
                Lupa nomor bangku? Cari data berdasarkan Nama & Kelas.
              </div>
              
              <div className="group">
                <label className="block text-[#5d4037] text-[10px] font-black uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-[#8d6e63]">Cari Nama Anak</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-4 bg-[#fff8e1]/80 border-2 border-[#d7ccc8] focus:bg-white focus:border-[#8d6e63] focus:ring-4 focus:ring-[#8d6e63]/20 rounded-2xl outline-none text-[#3e2723] font-bold transition-all duration-300 placeholder:text-[#a1887f]" 
                  placeholder="Nama..." 
                  value={searchData.childName} // Binding Value
                  onChange={(e) => setSearchData({...searchData, childName: e.target.value})} 
                />
              </div>

              <div className="relative group">
                <label className="block text-[#5d4037] text-[10px] font-black uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-[#8d6e63]">Cari Kelas</label>
                <button 
                  type="button" 
                  onClick={() => setIsSearchDropdownOpen(!isSearchDropdownOpen)} 
                  className="w-full p-4 bg-[#fff8e1]/80 border-2 border-[#d7ccc8] focus:bg-white focus:border-[#8d6e63] focus:ring-4 focus:ring-[#8d6e63]/20 rounded-2xl text-left flex justify-between items-center outline-none transition-all duration-300 text-[#3e2723]"
                >
                  <span className="font-bold">{searchData.childClass}</span>
                  <span className={`text-[#8d6e63] transition-transform duration-300 ${isSearchDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {isSearchDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsSearchDropdownOpen(false)}></div>
                    <div className="absolute left-0 right-0 top-full mt-2 bg-[#fff8e1] border border-[#d7ccc8] rounded-2xl shadow-xl z-20 overflow-hidden p-2 max-h-56 overflow-y-auto custom-scrollbar animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
                      {classOptions.map((option) => (
                        <div 
                          key={option} 
                          onClick={() => { setSearchData({ ...searchData, childClass: option }); setIsSearchDropdownOpen(false); }} 
                          className={`p-3 rounded-xl cursor-pointer font-bold text-sm mb-1 transition-colors ${
                            searchData.childClass === option 
                            ? 'bg-[#5d4037] text-white' 
                            : 'text-[#5d4037] hover:bg-[#d7ccc8]'
                          }`}
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
                className="w-full text-white font-bold py-4 rounded-2xl shadow-xl shadow-[#3e2723]/20 mt-4 flex justify-center items-center gap-3 transform transition-all duration-300 active:scale-95 hover:brightness-110 hover:shadow-2xl group" 
                style={{ background: 'linear-gradient(to right, #8d6e63, #6d4c41)' }}
              >
                {loading ? (
                  <span>Mencari...</span>
                ) : (
                  <>
                    <span>Cek Tiket Saya</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-[#efebe9] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1">
                      <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
      
      <div className="fixed bottom-4 text-center w-full text-[#3e2723] text-[10px] font-medium tracking-widest uppercase opacity-80 animate-fade-in-up delay-500" style={{ textShadow: '0px 0px 10px rgba(255,255,255,0.8)' }}>
        © 2026 TK Aisyiyah 21 Rawamangun
      </div>
    </div>
  );
}