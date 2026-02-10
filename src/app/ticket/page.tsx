"use client";
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; // Tambah useRouter
import { supabase } from '@/lib/supabaseClient';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';

// --- TIPE DATA ---
type Registration = { id: string; child_name: string; child_class: string };
type Seat = {
  id: string;
  row_name: string;
  seat_number: number;
  is_occupied: boolean;
  assigned_to: string | null;
  registrations?: Registration | null;
};
type FullRegistration = { id: string; child_name: string; child_class: string; };
type GroupedGuest = { regId: string; childName: string; childClass: string; seatNumbers: string[]; };
type GuestSeatData = {
  id: string;
  row_name: string;
  seat_number: number;
  assigned_to: string;
  registrations: { id: string; child_name: string; child_class: string } | { id: string; child_name: string; child_class: string }[] | null;
};

export default function TicketPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#fff8e1] text-[#5d4037] font-bold">Sedang Memuat Tiket...</div>}>
      <TicketContent />
    </Suspense>
  );
}

function TicketContent() {
  const router = useRouter(); // Init router
  const searchParams = useSearchParams();
  const regId = searchParams.get('id');
  const ticketRef = useRef<HTMLDivElement>(null);

  const [mySeats, setMySeats] = useState<Seat[]>([]);
  const [allSeats, setAllSeats] = useState<Seat[]>([]);
  const [studentData, setStudentData] = useState<FullRegistration | null>(null);
  const [guestList, setGuestList] = useState<GroupedGuest[]>([]);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (typeof window !== 'undefined') setBaseUrl(window.location.origin);
      
      if (regId) {
        const { data: reg } = await supabase.from('registrations').select('*').eq('id', regId).maybeSingle();
        if (reg) setStudentData(reg);
        
        const { data: mySeat } = await supabase.from('seats').select('*').eq('assigned_to', regId).order('row_name').order('seat_number');
        if (mySeat) setMySeats(mySeat);
      }

      const { data: all } = await supabase.from('seats').select('*').order('row_name').order('seat_number');
      if (all) setAllSeats(all);

      const { data: guests } = await supabase
        .from('seats')
        .select(`id, row_name, seat_number, is_occupied, assigned_to, registrations (id, child_name, child_class)`)
        .eq('is_occupied', true)
        .not('assigned_to', 'is', null)
        .order('row_name', { ascending: true })
        .order('seat_number', { ascending: true });
        
      if (guests) {
         const groupedMap = new Map<string, GroupedGuest>();
         (guests as unknown as GuestSeatData[]).forEach((seat) => {
            const reg = Array.isArray(seat.registrations) ? seat.registrations[0] : seat.registrations;
            if (!reg) return;
            
            const seatLabel = `${seat.row_name}-${seat.seat_number}`;

            if (!groupedMap.has(reg.id)) {
              groupedMap.set(reg.id, {
                regId: reg.id,
                childName: reg.child_name,
                childClass: reg.child_class,
                seatNumbers: []
              });
            }
            groupedMap.get(reg.id)?.seatNumbers.push(seatLabel);
         });
         setGuestList(Array.from(groupedMap.values()));
      }
    };
    fetchData();
  }, [regId]);

  const downloadUpdatedTicket = async () => {
    if (!ticketRef.current) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 4 });
      const link = document.createElement("a");
      link.download = `VIP-Ticket-${studentData?.child_name || 'Event'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error("Gagal download:", err); }
  };

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  const getSeatColorClass = (row: string, isMine: boolean, isTaken: boolean) => {
    if (isMine) return 'bg-[#5d4037] text-white shadow-lg shadow-[#3e2723]/40 z-10 scale-110 ring-2 ring-offset-2 ring-[#a1887f] border-none'; 
    if (isTaken) return 'bg-[#d7ccc8] text-[#a1887f] cursor-not-allowed border border-[#bcaaa4]'; 
    if (row === 'A') return 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'; 
    if (row === 'B' || row === 'C') return 'bg-pink-100 text-pink-800 border border-pink-300 hover:bg-pink-200'; 
    return 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'; 
  };

  return (
    <div 
      className="min-h-screen text-[#3e2723] p-4 md:p-6 pb-40 font-sans relative overflow-x-hidden" 
      style={{ 
        backgroundImage: "url('/Background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-[#3e2723]/5 pointer-events-none"></div>
      
      <div className="text-center mb-8 pt-4 relative z-10 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#fff8e1] text-[#5d4037] rounded-full text-xs font-bold uppercase tracking-widest mb-3 border border-[#d7ccc8] shadow-sm">
          <span>📍</span> Denah Lokasi
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-[#3e2723] tracking-tight drop-shadow-sm">TK Aisyiyah 21</h1>
        <p className="text-[#5d4037] font-medium text-xs md:text-sm mt-1">Rawamangun • Pentas Seni 2026</p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mb-6 relative z-10 animate-fade-in-up delay-100">
         <div className="flex items-center gap-2 bg-white/80 px-3 py-1 rounded-full shadow-sm"><div className="w-3 h-3 bg-green-200 border border-green-400 rounded-full"></div><span className="text-[10px] font-bold text-green-800 uppercase">VIP (A)</span></div>
         <div className="flex items-center gap-2 bg-white/80 px-3 py-1 rounded-full shadow-sm"><div className="w-3 h-3 bg-pink-200 border border-pink-400 rounded-full"></div><span className="text-[10px] font-bold text-pink-800 uppercase">Panitia (B-C)</span></div>
         <div className="flex items-center gap-2 bg-white/80 px-3 py-1 rounded-full shadow-sm"><div className="w-3 h-3 bg-blue-100 border border-blue-400 rounded-full"></div><span className="text-[10px] font-bold text-blue-800 uppercase">Umum (D-L)</span></div>
      </div>

      <div className="max-w-5xl mx-auto overflow-hidden rounded-3xl bg-[#fff8e1]/90 backdrop-blur-sm border border-[#d7ccc8] shadow-xl mb-12 relative z-10 animate-fade-in-up delay-100">
        <div className="md:hidden bg-[#d7ccc8] text-[#5d4037] text-[10px] font-bold text-center py-2 flex items-center justify-center gap-2">
           <span>↔️</span> Geser ke samping untuk melihat posisi
        </div>
        <div className="overflow-x-auto p-0 md:p-10 custom-scrollbar relative">
          <div style={{ minWidth: 'max-content' }} className="text-center mx-auto p-6">
            <div className="mb-10 md:mb-14 relative mx-auto md:w-2/3!" style={{ width: '600px' }}>
               <div className="absolute inset-0 bg-[#8d6e63]/20 blur-3xl rounded-full"></div>
               <div className="h-12 md:h-16 rounded-b-[80px] md:rounded-b-[100px] shadow-xl shadow-[#3e2723]/20 flex items-center justify-center relative z-10 border-t-4 border-[#a1887f]" style={{ background: 'linear-gradient(to bottom, #8d6e63, #5d4037)' }}>
                  <span className="text-[10px] font-black tracking-[0.4em] text-[#efebe9] uppercase mt-2">Panggung Utama</span>
               </div>
            </div>
            <div className="space-y-3 md:space-y-4">
              {rows.map((rowName) => {
                const seatsInRow = allSeats.filter(s => s.row_name === rowName);
                const halfIndex = Math.floor(seatsInRow.length / 2);
                return (
                  <div key={rowName} className="flex justify-center items-center gap-2 md:gap-3">
                    <div className="sticky left-0 z-20 bg-[#fff8e1]/95 backdrop-blur px-2 md:px-3 py-1 rounded-r-lg shadow-sm border-r border-[#d7ccc8] font-black text-[#a1887f] text-xs md:text-sm w-8 md:w-10 shrink-0">{rowName}</div>
                    {seatsInRow.map((seat, index) => {
                      const isMine = seat.assigned_to === regId;
                      const isTaken = seat.is_occupied && !isMine;
                      const isAisle = index === halfIndex; 
                      const colorClass = getSeatColorClass(rowName, isMine, isTaken);
                      return (
                        <div key={seat.id} className={`${isAisle ? 'ml-12 md:ml-20' : ''} w-8 h-8 md:w-10 md:h-10 text-[9px] md:text-xs shrink-0 flex items-center justify-center font-bold transition-all duration-300 rounded-lg md:rounded-xl shadow-sm ${colorClass}`}>
                          {seat.seat_number}
                        </div>
                      );
                    })}
                    <div className="sticky right-0 z-20 bg-[#fff8e1]/95 backdrop-blur px-2 md:px-3 py-1 rounded-l-lg shadow-sm border-l border-[#d7ccc8] font-black text-[#a1887f] text-xs md:text-sm w-8 md:w-10 shrink-0">{rowName}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {regId && (
        <div className="max-w-md mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-[#3e2723]/10 border border-[#d7ccc8] mb-16 relative z-10 animate-fade-in-up delay-200">
           <div className="absolute inset-0 bg-[#fff8e1]"></div> 
          <div className="p-6 text-center relative overflow-hidden bg-[#5d4037]">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
             <h3 className="text-[#efebe9] font-bold text-lg relative z-10">Tiket Anda</h3>
             <p className="text-[#d7ccc8] text-xs relative z-10">Silakan unduh tiket terbaru jika ada perubahan</p>
          </div>
          <div className="p-8 relative">
            <div className="flex justify-between items-center border-b border-[#d7ccc8] pb-5 mb-5">
                <div>
                    <p className="text-[10px] text-[#8d6e63] font-bold uppercase tracking-wider mb-1">Nama Siswa</p>
                    <p className="text-lg font-black text-[#3e2723] capitalize">{studentData?.child_name}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-[#8d6e63] font-bold uppercase tracking-wider mb-1">Kelas</p>
                    <p className="text-lg font-black text-[#5d4037]">{studentData?.child_class}</p>
                </div>
            </div>
            <div className="bg-[#efebe9] p-5 rounded-2xl flex justify-between items-center mb-8 border border-[#d7ccc8]">
                <span className="font-bold text-[#5d4037] text-sm">Nomor Kursi</span>
                <span className="text-3xl font-black text-[#3e2723] tracking-tight">{mySeats.map(s => `${s.row_name}-${s.seat_number}`).join(" & ")}</span>
            </div>
            
            <div className="flex flex-col gap-3">
                <button onClick={downloadUpdatedTicket} className="w-full py-4 bg-linear-to-r from-[#6d4c41] to-[#3e2723] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 group">
                <span className="group-hover:animate-bounce">📥</span> Download E-Ticket
                </button>

                {/* --- TOMBOL KEMBALI KE HOME --- */}
                <button 
                    onClick={() => router.push('/')} 
                    className="w-full py-4 bg-[#fff8e1] text-[#5d4037] font-bold rounded-xl border-2 border-[#5d4037] hover:bg-[#d7ccc8] transition-all active:scale-95"
                >
                    🏠 Kembali ke Menu Utama
                </button>
            </div>

          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto relative z-10 animate-fade-in-up delay-300">
        <h3 className="text-center text-lg font-black text-white py-4 mb-6 bg-linear-to-r from-[#6d4c41] to-[#3e2723] rounded-xl uppercase tracking-widest text-shadow-sm">Daftar Teman Hadir</h3>
        <div className="bg-[#fff8e1]/90 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl border border-[#d7ccc8]">
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left text-[#5d4037]">
              <thead className="bg-[#efebe9] text-[#8d6e63] sticky top-0 uppercase text-[10px] font-bold tracking-wider border-b border-[#d7ccc8]">
                <tr>
                  <th className="px-6 py-4">Kursi</th>
                  <th className="px-6 py-4">Nama Siswa</th>
                  <th className="px-6 py-4">Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d7ccc8]">
                {guestList.map((guest) => (
                  <tr key={guest.regId} className="hover:bg-[#d7ccc8]/30 transition-colors">
                    <td className="px-6 py-4 font-black text-[#3e2723] text-xs">{guest.seatNumbers.join(", ")}</td>
                    <td className="px-6 py-4 font-bold text-[#5d4037] capitalize">{guest.childName || 'Tamu'}</td>
                    <td className="px-6 py-4">
                      <span className="bg-[#efebe9] text-[#5d4037] px-2 py-1 rounded text-xs font-bold border border-[#d7ccc8]">
                        {guest.childClass}
                      </span>
                    </td>
                  </tr>
                ))}
                {guestList.length === 0 && <tr><td colSpan={3} className="text-center py-10 text-[#a1887f] font-medium">Belum ada yang mendaftar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#fff8e1]/95 backdrop-blur-md px-4 md:px-6 py-3 rounded-full flex items-center gap-4 md:gap-6 border border-[#d7ccc8] shadow-2xl z-50 w-max max-w-[90%] justify-center animate-fade-in-up delay-500">
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#5d4037] rounded-full shadow-sm"></div><span className="text-[10px] font-bold text-[#5d4037] uppercase">Kamu</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#d7ccc8] rounded-full"></div><span className="text-[10px] font-bold text-[#a1887f] uppercase">Terisi</span></div>
      </div>

      <div className="absolute -z-50 opacity-0 pointer-events-none top-0 left-0">
        <div ref={ticketRef} style={{ width: '600px', background: '#1c1917', padding: '20px', fontFamily: 'sans-serif' }}>
          <div style={{ backgroundImage: "url('/Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', border: '4px solid #5d4037' }}>
            <div style={{ flex: 1, padding: '40px', position: 'relative', borderRight: '3px dashed #5d4037' }}>
               <div style={{ position: 'absolute', top: '-100px', left: '-50px', fontSize: '200px', fontWeight: 900, color: '#3e2723', opacity: 0.1, zIndex: 0 }}>21</div>
               <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#5d4037', letterSpacing: '4px', marginBottom: '10px' }}>ADMISSION TICKET</p>
                  <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#3e2723', lineHeight: 1, margin: '0 0 40px 0', textShadow: '1px 1px 0px rgba(255,255,255,0.4)' }}>PENTAS SENI<br/>2026</h1>
                  <div style={{ marginBottom: '30px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#8d6e63', textTransform: 'uppercase', marginBottom: '5px' }}>Guest Name</p>
                    <p style={{ fontSize: '32px', fontWeight: 900, color: '#3e2723', textTransform: 'capitalize' }}>{studentData?.child_name}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '40px' }}>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#8d6e63', textTransform: 'uppercase' }}>Class</p>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: '#3e2723' }}>{studentData?.child_class}</p>
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
                  <h2 style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1.1, margin: 0, wordWrap: 'break-word', color: '#ffffff' }}>
                      {mySeats.map(s => `${s.row_name}-${s.seat_number}`).join("/")}
                  </h2>
               </div>
               <div style={{ background: '#fff8e1', padding: '10px', borderRadius: '16px' }}>
                  {regId && baseUrl && <QRCodeSVG value={`${baseUrl}/ticket?id=${regId}`} size={100} level={"H"} fgColor="#3e2723" bgColor="#fff8e1" />}
               </div>
               <p style={{ fontSize: '10px', fontWeight: 700, opacity: 0.8, textAlign: 'center', color: '#d7ccc8' }}>TK AISYIYAH 21<br/>RAWAMANGUN</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}