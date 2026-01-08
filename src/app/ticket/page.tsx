"use client";
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  registrations: { id: string; child_name: string; child_class: string } | { id: string; child_name: string; child_class: string }[] | null;
};

export default function TicketPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 font-bold">Memuat Data...</div>}>
      <TicketContent />
    </Suspense>
  );
}

function TicketContent() {
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
      if (typeof window !== 'undefined') {
        setBaseUrl(window.location.origin);
      }

      if (regId) {
        const { data: reg } = await supabase.from('registrations').select('*').eq('id', regId).single();
        if (reg) setStudentData(reg);
        
        const { data: mySeat } = await supabase.from('seats').select('*').eq('assigned_to', regId);
        if (mySeat) setMySeats(mySeat);
      }

      const { data: all } = await supabase.from('seats').select('*').order('row_name').order('seat_number');
      if (all) setAllSeats(all);

      // --- LOGIKA FETCH & GROUPING TAMU ---
      const { data: guests } = await supabase
        .from('seats')
        .select(`id, seat_number, is_occupied, assigned_to, registrations (id, child_name, child_class)`)
        .eq('is_occupied', true)
        .not('assigned_to', 'is', null)
        .order('id', { ascending: true });
        
      if (guests) {
         const groupedMap = new Map<string, GroupedGuest>();

         (guests as unknown as GuestSeatData[]).forEach((seat) => {
            const reg = Array.isArray(seat.registrations) ? seat.registrations[0] : seat.registrations;
            
            if (!reg) return;

            if (!groupedMap.has(reg.id)) {
              groupedMap.set(reg.id, {
                regId: reg.id,
                childName: reg.child_name,
                childClass: reg.child_class,
                seatNumbers: []
              });
            }
            groupedMap.get(reg.id)?.seatNumbers.push(seat.id);
         });

         setGuestList(Array.from(groupedMap.values()));
      }
    };

    fetchData();
  }, [regId]);

  const downloadUpdatedTicket = async () => {
    if (!ticketRef.current) return;
    try {
      // Pixel ratio tinggi agar hasil download tajam (HD)
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 4 });
      const link = document.createElement("a");
      link.download = `VIP-Ticket-${studentData?.child_name || 'Event'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal download:", err);
    }
  };

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    // FIX 1: Gradient Inline Style pada Background Body
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 pb-40 font-sans relative" style={{ background: 'linear-gradient(to bottom, #f9fafb, #ffffff)' }}>
      
      {/* HEADER PAGE */}
      <div className="text-center mb-10 pt-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
          <span>📍</span> Denah Lokasi
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">TK Aisyiyah 21</h1>
        <p className="text-gray-400 font-medium text-sm mt-1">Rawamangun • Pentas Seni 2026</p>
      </div>

      {/* PETA VISUAL (Modern Rounded Style) */}
      <div className="max-w-5xl mx-auto overflow-x-auto rounded-[2.5rem] p-10 bg-white border border-gray-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] mb-12 relative z-10">
        <div style={{ minWidth: '800px' }} className="text-center">
          
          {/* PANGGUNG MODERN (Curved) */}
          <div className="mb-14 relative mx-auto w-2/3">
             <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full"></div>
             {/* FIX 2: Gradient Inline Style pada Panggung */}
             <div 
                className="h-16 rounded-b-[100px] shadow-xl shadow-orange-500/20 flex items-center justify-center relative z-10 border-t-4 border-orange-300"
                style={{ background: 'linear-gradient(to bottom, #fb923c, #ea580c)' }}
             >
                <span className="text-[10px] font-black tracking-[0.4em] text-white uppercase mt-2">Panggung Utama</span>
             </div>
          </div>

          {/* GRID KURSI */}
          <div className="space-y-4">
            {rows.map((rowName) => {
              const seatsInRow = allSeats.filter(s => s.row_name === rowName);
              const halfIndex = Math.floor(seatsInRow.length / 2);
              return (
                <div key={rowName} className="flex justify-center items-center gap-3">
                  <div className="w-6 font-bold text-gray-300 text-xs">{rowName}</div>
                  {seatsInRow.map((seat, index) => {
                    const isMine = seat.assigned_to === regId;
                    const isTaken = seat.is_occupied && !isMine;
                    const isAisle = index === halfIndex; 
                    return (
                      <div 
                        key={seat.id} 
                        className={`
                          ${isAisle ? 'ml-20' : ''} 
                          w-10 h-10 flex items-center justify-center font-bold text-[10px] transition-all duration-300
                          ${isMine 
                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/40 z-10 scale-110 rounded-xl ring-2 ring-offset-2 ring-green-100' 
                            : isTaken 
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed rounded-lg border border-gray-200' 
                              : 'bg-white text-gray-500 border border-gray-200 hover:border-orange-400 hover:text-orange-500 hover:shadow-md rounded-xl cursor-pointer'
                          }
                        `}
                      >
                        {seat.seat_number}
                      </div>
                    );
                  })}
                  <div className="w-6 font-bold text-gray-300 text-xs">{rowName}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DETAIL TIKET & DOWNLOAD */}
      {regId && (
        <div className="max-w-md mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl shadow-blue-900/5 border border-gray-100 mb-16 relative z-10">
          {/* FIX 3: Gradient Inline Style pada Header Tiket */}
          <div className="p-6 text-center relative overflow-hidden" style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
             <h3 className="text-white font-bold text-lg relative z-10">Tiket Anda</h3>
             <p className="text-blue-100 text-xs relative z-10">Silakan unduh tiket terbaru jika ada perubahan</p>
          </div>
          <div className="p-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-5 mb-5">
                <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Nama Siswa</p>
                    <p className="text-lg font-black text-gray-800 capitalize">{studentData?.child_name}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Kelas</p>
                    <p className="text-lg font-black text-blue-600">{studentData?.child_class}</p>
                </div>
            </div>
            
            <div className="bg-orange-50 p-5 rounded-2xl flex justify-between items-center mb-8 border border-orange-100">
                <span className="font-bold text-orange-800 text-sm">Nomor Kursi</span>
                <span className="text-3xl font-black text-orange-600 tracking-tight">{mySeats.map(s => s.id).join(" & ")}</span>
            </div>

            <button 
              onClick={downloadUpdatedTicket}
              className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:bg-black transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <span>📥</span> Download E-Ticket
            </button>
          </div>
        </div>
      )}

      {/* DAFTAR TAMU HADIR */}
      <div className="max-w-3xl mx-auto relative z-10">
        <h3 className="text-center text-lg font-black text-gray-800 mb-6 uppercase tracking-widest">Daftar Teman Hadir</h3>
        <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100">
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="bg-gray-50 text-gray-400 sticky top-0 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Kursi</th>
                  <th className="px-6 py-4">Nama Siswa</th>
                  <th className="px-6 py-4">Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {guestList.map((guest) => (
                  <tr key={guest.regId} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 font-black text-blue-600 text-xs">{guest.seatNumbers.join(", ")}</td>
                    <td className="px-6 py-4 font-bold text-gray-800 capitalize">{guest.childName || 'Tamu'}</td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold border border-gray-200">
                        {guest.childClass}
                      </span>
                    </td>
                  </tr>
                ))}
                {guestList.length === 0 && <tr><td colSpan={3} className="text-center py-10 text-gray-400 font-medium">Belum ada yang mendaftar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* LEGENDA FIXED */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-6 border border-gray-200 shadow-2xl z-50">
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div><span className="text-[10px] font-bold text-gray-700 uppercase">Kamu</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded-full"></div><span className="text-[10px] font-bold text-gray-400 uppercase">Terisi</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border-2 border-gray-300 rounded-full"></div><span className="text-[10px] font-bold text-gray-700 uppercase">Kosong</span></div>
      </div>

      {/* --- RENDER ETICKET HIDDEN (PREMIUM STUB DESIGN) --- */}
      {/* Ini adalah bagian yang akan di-convert jadi gambar .PNG */}
      <div className="absolute -z-50 opacity-0 pointer-events-none top-0 left-0">
        <div ref={ticketRef} style={{ 
          width: '600px', 
          background: '#111827', // Dark Mode Background
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
            {/* Left Section (Informasi Utama) */}
            <div style={{ flex: 1, padding: '40px', position: 'relative', borderRight: '3px dashed #f3f4f6' }}>
               {/* Watermark Angka 21 */}
               <div style={{ position: 'absolute', top: '-100px', left: '-50px', fontSize: '200px', fontWeight: 900, color: '#f9fafb', zIndex: 0 }}>21</div>
               
               <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#ea580c', letterSpacing: '4px', marginBottom: '10px' }}>ADMISSION TICKET</p>
                  <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#111827', lineHeight: 1, margin: '0 0 40px 0' }}>PENTAS SENI<br/>2026</h1>
                  
                  <div style={{ marginBottom: '30px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '5px' }}>Guest Name</p>
                    <p style={{ fontSize: '32px', fontWeight: 900, color: '#111827', textTransform: 'capitalize' }}>{studentData?.child_name}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '40px' }}>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Class</p>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: '#111827' }}>{studentData?.child_class}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Hall</p>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: '#111827' }}>AUDITORIUM</p>
                    </div>
                  </div>
               </div>

               {/* Lubang Dekorasi (Cutouts) */}
               <div style={{ position: 'absolute', bottom: '80px', right: '-15px', width: '30px', height: '30px', background: '#111827', borderRadius: '50%' }}></div>
               <div style={{ position: 'absolute', top: '80px', right: '-15px', width: '30px', height: '30px', background: '#111827', borderRadius: '50%' }}></div>
            </div>

            {/* Right Section (Sobekan Stub) */}
            <div style={{ width: '200px', background: '#ea580c', padding: '40px 20px', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
               <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', marginBottom: '10px' }}>SEAT NO.</p>
                  <h2 style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1, margin: 0 }}>{mySeats.map(s => s.id).join("/")}</h2>
               </div>

               <div style={{ background: 'white', padding: '10px', borderRadius: '16px' }}>
                  {regId && baseUrl && <QRCodeSVG value={`${baseUrl}/ticket?id=${regId}`} size={100} level={"H"} fgColor="#ea580c" />}
               </div>

               <p style={{ fontSize: '10px', fontWeight: 700, opacity: 0.8, textAlign: 'center' }}>TK AISYIYAH 21<br/>RAWAMANGUN</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}