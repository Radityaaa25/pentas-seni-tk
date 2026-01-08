"use client";
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';

// Tipe Data
type Registration = { id: string; child_name: string; child_class: string };
type Seat = { id: string; row_name: string; seat_number: number; is_occupied: boolean; assigned_to: string | null; registrations?: Registration | null; };
type FullRegistration = { id: string; child_name: string; child_class: string; };
type GroupedGuest = { regId: string; childName: string; seatNumbers: string[]; };
type GuestSeatData = { id: string; registrations: { id: string; child_name: string } | { id: string; child_name: string }[] | null; };

export default function TicketPage() {
  return ( <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">Loading Peta...</div>}> <TicketContent /> </Suspense> );
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
      const { data: guests } = await supabase.from('seats').select(`id, seat_number, is_occupied, assigned_to, registrations (id, child_name)`).eq('is_occupied', true).not('assigned_to', 'is', null).order('id', { ascending: true });
      if (guests) {
         const groupedMap = new Map<string, GroupedGuest>();
         (guests as unknown as GuestSeatData[]).forEach((seat) => {
            const reg = Array.isArray(seat.registrations) ? seat.registrations[0] : seat.registrations;
            if (!reg) return;
            if (!groupedMap.has(reg.id)) { groupedMap.set(reg.id, { regId: reg.id, childName: reg.child_name, seatNumbers: [] }); }
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
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `Tiket-TK21-${studentData?.child_name || 'Update'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error("Gagal download:", err); }
  };

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4 pb-32 font-sans relative">
      
      {/* HEADER */}
      <div className="text-center mb-8 pt-4">
        <h1 className="text-2xl font-black text-gray-800 mb-1 tracking-tight">Denah Lokasi</h1>
        <p className="text-orange-500 font-bold text-sm">TK Aisyiyah 21 Rawamangun</p>
      </div>

      {/* PETA VISUAL */}
      <div className="max-w-5xl mx-auto overflow-x-auto rounded-3xl p-8 bg-white border border-gray-200 shadow-xl mb-10 relative z-10">
        <div style={{ minWidth: '800px' }} className="text-center">
          <div className="mb-10 relative mx-auto w-2/3">
             <div className="h-12 bg-orange-400 rounded-full shadow-lg shadow-orange-400/20 flex items-center justify-center border-4 border-orange-200">
                <span className="text-xs font-black tracking-[0.3em] text-white uppercase">Panggung (Stage)</span>
             </div>
          </div>
          <div className="space-y-3">
            {rows.map((rowName) => {
              const seatsInRow = allSeats.filter(s => s.row_name === rowName);
              const halfIndex = Math.floor(seatsInRow.length / 2);
              return (
                <div key={rowName} className="flex justify-center items-center gap-2">
                  <div className="w-6 font-bold text-gray-400 text-xs">{rowName}</div>
                  {seatsInRow.map((seat, index) => {
                    const isMine = seat.assigned_to === regId;
                    const isTaken = seat.is_occupied && !isMine;
                    const isAisle = index === halfIndex; 
                    return (
                      <div key={seat.id} className={`${isAisle ? 'ml-14' : ''} w-10 h-10 flex items-center justify-center font-bold text-xs transition-all rounded-xl shadow-sm ${isMine ? 'bg-green-500 text-white shadow-lg shadow-green-500/40 z-10 scale-110 ring-2 ring-green-200' : isTaken ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:bg-orange-50 hover:border-orange-300'}`}>
                        {seat.seat_number}
                      </div>
                    );
                  })}
                  <div className="w-6 font-bold text-gray-400 text-xs">{rowName}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DETAIL TIKET & DOWNLOAD */}
      {regId && (
        <div className="max-w-md mx-auto bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-200 mb-16 relative z-10">
          <div className="bg-orange-500 p-4 text-center">
             <h3 className="text-white font-bold text-lg">Tiket Anda</h3>
          </div>
          <div className="p-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Nama</p><p className="text-lg font-black text-gray-800 capitalize">{studentData?.child_name}</p></div>
                <div className="text-right"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Kelas</p><p className="text-lg font-black text-orange-500">{studentData?.child_class}</p></div>
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl flex justify-between items-center mb-6 border border-orange-100">
                <span className="font-bold text-orange-800">Nomor Kursi</span>
                <span className="text-3xl font-black text-orange-600">{mySeats.map(s => s.id).join(" & ")}</span>
            </div>
            <button onClick={downloadUpdatedTicket} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-transform active:scale-95 flex items-center justify-center gap-2">
              📥 Download Update Tiket
            </button>
          </div>
        </div>
      )}

      {/* DAFTAR TAMU HADIR */}
      <div className="max-w-2xl mx-auto relative z-10">
        <h3 className="text-center text-lg font-bold text-gray-600 mb-4 uppercase tracking-widest">Daftar Teman Hadir</h3>
        <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200">
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="bg-gray-100 text-gray-500 sticky top-0 uppercase text-xs font-bold tracking-wider">
                <tr><th className="px-6 py-4">Kursi</th><th className="px-6 py-4">Nama Teman</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {guestList.map((guest) => (
                  <tr key={guest.regId} className="hover:bg-orange-50 transition-colors">
                    <td className="px-6 py-4 font-black text-orange-600">{guest.seatNumbers.join(", ")}</td>
                    <td className="px-6 py-4 font-medium capitalize text-gray-800">{guest.childName || 'Tamu'}</td>
                  </tr>
                ))}
                {guestList.length === 0 && <tr><td colSpan={2} className="text-center py-8 text-gray-400">Belum ada yang mendaftar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* LEGENDA FIXED */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-3 rounded-full flex items-center gap-6 border border-gray-200 shadow-xl z-50">
         <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded-md"></div><span className="text-xs font-bold text-gray-700">Kamu</span></div>
         <div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-200 rounded-md"></div><span className="text-xs font-bold text-gray-400">Terisi</span></div>
         <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-gray-300 rounded-md"></div><span className="text-xs font-bold text-gray-700">Kosong</span></div>
      </div>

      {/* --- HIDDEN TICKET (DESAIN BARU YANG LEBIH BAGUS) --- */}
      <div className="absolute -z-50 opacity-0 pointer-events-none top-0 left-0">
        <div ref={ticketRef} style={{ width: '400px', height: 'auto', background: 'linear-gradient(to bottom, #fff7ed, #ffedd5)', borderRadius: '30px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', position: 'relative', border: '4px solid white' }}>
          {/* Pattern Overlay Halus */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.05, background: 'radial-gradient(circle, #f97316 2px, transparent 2px)', backgroundSize: '20px 20px', zIndex: 1 }}></div>
          
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Header Festive */}
            <div style={{ background: 'linear-gradient(135deg, #fb923c, #ea580c)', padding: '30px 20px', textAlign: 'center', color: 'white', borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', boxShadow: '0 4px 15px rgba(234, 88, 12, 0.3)' }}>
                 <div style={{ fontSize: '24px', marginBottom: '5px' }}>✨🎭🎈</div>
                 <h1 style={{ fontSize: '26px', fontWeight: 900, margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)', letterSpacing: '1px' }}>TIKET PENTAS SENI</h1>
                 <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.9, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>TK Aisyiyah 21 Rawamangun • 2026</p>
            </div>
            
            {/* Body Tiket */}
            <div style={{ padding: '35px 25px', textAlign: 'center' }}>
                 <p style={{ fontSize: '11px', color: '#f97316', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Peserta Didik</p>
                 <h2 style={{ fontSize: '36px', fontWeight: 900, color: '#1f2937', margin: '5px 0 30px 0', textTransform: 'capitalize', lineHeight: 1.2 }}>{studentData?.child_name}</h2>

                 {/* Badge Area */}
                 <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    {/* Kelas Info */}
                    <div style={{ background: '#fff', padding: '15px 20px', borderRadius: '24px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', flex: 1, border: '2px solid #fff7ed' }}>
                        <p style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Kelas</p>
                        <p style={{ fontSize: '22px', fontWeight: 800, color: '#ea580c' }}>{studentData?.child_class}</p>
                    </div>
                    {/* Kursi Badge (Menonjol) */}
                    <div style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', padding: '15px 20px', borderRadius: '24px', boxShadow: '0 8px 20px rgba(249, 115, 22, 0.4)', flex: 1.2, color: 'white', border: '2px solid #fb923c' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 1 }}>No. Kursi</p>
                        <p style={{ fontSize: '30px', fontWeight: 900 }}>{mySeats.map(s => s.id).join(" & ")}</p>
                    </div>
                 </div>
            </div>

            {/* Garis Putus-putus Dekoratif */}
            <div style={{ height: '4px', background: "repeating-linear-gradient(to right, #fed7aa 0, #fed7aa 6px, transparent 6px, transparent 12px)", margin: '0 20px' }}></div>

            {/* Footer QR */}
            <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <div style={{ background: 'white', padding: '14px', borderRadius: '20px', boxShadow: '0 5px 15px rgba(0,0,0,0.08)', border: '2px solid #fff7ed' }}>
                   {regId && baseUrl && <QRCodeSVG value={`${baseUrl}/ticket?id=${regId}`} size={90} level={"H"} fgColor="#1f2937" />}
                 </div>
                 <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scan untuk Denah Lokasi</p>
                 <p style={{ fontSize: '10px', color: '#ea580c', marginTop: '5px', fontWeight: 800 }}>Official E-Ticket</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}