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
      if (typeof window !== 'undefined') setBaseUrl(window.location.origin);
      if (regId) {
        const { data: reg } = await supabase.from('registrations').select('*').eq('id', regId).single();
        if (reg) setStudentData(reg);
        const { data: mySeat } = await supabase.from('seats').select('*').eq('assigned_to', regId);
        if (mySeat) setMySeats(mySeat);
      }
      const { data: all } = await supabase.from('seats').select('*').order('row_name').order('seat_number');
      if (all) setAllSeats(all);

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
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 4 });
      const link = document.createElement("a");
      link.download = `VIP-Ticket-${studentData?.child_name || 'Event'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error("Gagal download:", err); }
  };

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    // PERBAIKAN: Tambahkan 'overflow-x-hidden'
    <div className="min-h-screen bg-white text-gray-800 p-6 pb-40 font-sans relative overflow-x-hidden" style={{ background: 'linear-gradient(to bottom, #f9fafb, #ffffff)' }}>
      
      {/* HEADER PAGE */}
      <div className="text-center mb-12 pt-6">
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">PETA LOKASI & TIKET</h1>
        <div className="h-1 w-20 bg-orange-500 mx-auto mt-2"></div>
      </div>

      {/* PETA VISUAL */}
      <div className="max-w-5xl mx-auto overflow-x-auto rounded-3xl p-10 bg-white border-4 border-gray-100 shadow-2xl mb-12 relative z-10">
        <div style={{ minWidth: '800px' }} className="text-center">
          <div className="mb-14 relative mx-auto w-2/3">
             <div className="h-16 rounded-b-[50px] shadow-xl flex items-center justify-center relative z-10 border-t-8 border-orange-300" style={{ background: 'linear-gradient(to bottom, #fb923c, #ea580c)' }}>
                <span className="text-[12px] font-black tracking-[0.5em] text-white uppercase">PANGGUNG UTAMA</span>
             </div>
          </div>

          <div className="space-y-4">
            {rows.map((rowName) => {
              const seatsInRow = allSeats.filter(s => s.row_name === rowName);
              const halfIndex = Math.floor(seatsInRow.length / 2);
              return (
                <div key={rowName} className="flex justify-center items-center gap-3">
                  <div className="w-8 font-black text-gray-200 text-sm">{rowName}</div>
                  {seatsInRow.map((seat, index) => {
                    const isMine = seat.assigned_to === regId;
                    const isTaken = seat.is_occupied && !isMine;
                    const isAisle = index === halfIndex; 
                    return (
                      <div 
                        key={seat.id} 
                        className={`
                          ${isAisle ? 'ml-20' : ''} 
                          w-11 h-11 flex items-center justify-center font-bold text-xs transition-all duration-300 rounded-xl
                          ${isMine 
                            ? 'bg-orange-500 text-white shadow-2xl scale-125 z-10 ring-4 ring-orange-200' 
                            : isTaken 
                              ? 'bg-gray-800 text-gray-600' 
                              : 'bg-gray-100 text-gray-400 border-2 border-gray-200 hover:border-orange-500 hover:text-orange-500'
                          }
                        `}
                      >
                        {seat.seat_number}
                      </div>
                    );
                  })}
                  <div className="w-8 font-black text-gray-200 text-sm">{rowName}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DOWNLOAD SECTION */}
      {regId && (
        <div className="max-w-md mx-auto mb-20">
            <button 
              onClick={downloadUpdatedTicket}
              className="w-full py-6 bg-orange-600 text-white font-black rounded-full shadow-[0_15px_30px_rgba(234,88,12,0.4)] hover:bg-orange-700 transition-all active:scale-95 flex items-center justify-center gap-4 text-xl tracking-tight"
            >
              <span>🎟️</span> SIMPAN TIKET VIP
            </button>
        </div>
      )}

      {/* DAFTAR KEHADIRAN */}
      <div className="max-w-3xl mx-auto">
        <h3 className="text-center text-xl font-black text-gray-900 mb-8 tracking-widest uppercase">Daftar Kehadiran</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {guestList.map((guest) => (
             <div key={guest.regId} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-black">
                   {guest.seatNumbers[0]}
                </div>
                <div>
                   <p className="font-black text-gray-900 capitalize">{guest.childName}</p>
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{guest.childClass} • Kursi {guest.seatNumbers.join(" & ")}</p>
                </div>
             </div>
           ))}
           {guestList.length === 0 && <p className="col-span-full text-center text-gray-400">Belum ada peserta terdaftar.</p>}
        </div>
      </div>

      {/* --- RENDER ETICKET HIDDEN --- */}
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
               <div style={{ position: 'absolute', bottom: '80px', right: '-15px', width: '30px', height: '30px', background: '#111827', borderRadius: '50%' }}></div>
               <div style={{ position: 'absolute', top: '80px', right: '-15px', width: '30px', height: '30px', background: '#111827', borderRadius: '50%' }}></div>
            </div>
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

      {/* LEGENDA */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-4 rounded-full flex items-center gap-8 shadow-2xl z-50">
         <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-500 rounded-full"></div><span className="text-xs font-black uppercase">Milik Anda</span></div>
         <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-700 rounded-full"></div><span className="text-xs font-black uppercase">Terisi</span></div>
      </div>

    </div>
  );
}