// DebitMaster Stock Template API: Génère et télécharge un modèle Excel (.xlsx) ou CSV type pour l'import de stock de produits physiques.
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();

    // Colonnes types et exemples de données (uniquement produits physiques avec stock, exclusion stricte des services)
    const headers = [
      "Nom du produit",
      "Quantité en stock",
      "Prix de vente (XOF)",
      "Prix d'achat unitaire (XOF)",
      "Famille",
      "Conditionnement",
      "Unité",
      "Seuil d'alerte",
      "Seuil de sécurité",
    ];

    const sampleRows = [
      [
        "Béninoise 65cl",
        48,
        700,
        550,
        "BEVERAGE",
        "65",
        "bouteille",
        12,
        6,
      ],
      [
        "Guinness 33cl",
        24,
        1000,
        800,
        "BEVERAGE",
        "33",
        "bouteille",
        10,
        5,
      ],
      [
        "Eau Minérale Possotomé 1.5L",
        36,
        500,
        350,
        "BEVERAGE",
        "150",
        "bouteille",
        12,
        6,
      ],
      [
        "Riz Parfumé 25kg",
        10,
        18500,
        16000,
        "KITCHEN",
        "Sac",
        "sac",
        3,
        1,
      ],
      [
        "Huile Végétale 5L",
        8,
        7500,
        6200,
        "KITCHEN",
        "Bidon",
        "bidon",
        2,
        1,
      ],
    ];

    if (format === "csv") {
      const csvLines = [
        headers.join(";"),
        ...sampleRows.map((row) =>
          row
            .map((val) => {
              if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
              return val;
            })
            .join(";")
        ),
      ];
      const csvContent = "\uFEFF" + csvLines.join("\r\n");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="modele_import_stock_debitmaster.csv"',
        },
      });
    }

    // Format Excel (.xlsx) par défaut
    const worksheetData = [headers, ...sampleRows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Ajustement largeur des colonnes
    worksheet["!cols"] = [
      { wch: 30 }, // Nom
      { wch: 18 }, // Quantité
      { wch: 20 }, // Prix vente
      { wch: 25 }, // Prix achat
      { wch: 15 }, // Famille
      { wch: 18 }, // Conditionnement
      { wch: 14 }, // Unité
      { wch: 15 }, // Seuil alerte
      { wch: 18 }, // Seuil sécurité
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Produits");

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="modele_import_stock_debitmaster.xlsx"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Impossible de générer le modèle de fichier.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
