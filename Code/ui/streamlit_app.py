"""Budget Planner - Streamlit UI."""
from __future__ import annotations

import sys
from pathlib import Path
import uuid

sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
import pandas as pd
from app import data_store, budget, taxes, loan


def init_session_state():
    """Initialize session state variables."""
    if "current_user" not in st.session_state:
        st.session_state.current_user = "Me"
    if "prediction_months" not in st.session_state:
        st.session_state.prediction_months = 12


def load_user_data(username: str):
    """Load user data."""
    data_store.set_current_user(username)
    return data_store.load_user_data()


def save_user_data(user_data: dict, username: str):
    """Save user data."""
    data_store.save_user_data(user_data, username)
    st.success(f"✅ Saved!")


def tab_income_tax():
    """Tab 1: Income and Tax Breakdown."""
    st.header("💰 Income & Tax Breakdown")
    
    username = st.session_state.current_user
    user_data = load_user_data(username)
    
    # Edit gross income
    st.subheader("Annual Gross Income")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        gross_data = user_data["gross_income"]
        gross_data["base_salary"] = st.number_input(
            "Base Salary", value=gross_data["base_salary"], key="base_sal", step=100.0
        )
    
    with col2:
        gross_data["bonus"] = st.number_input(
            "Annual Bonus", value=gross_data["bonus"], key="bonus", step=100.0
        )
    
    with col3:
        gross_data["extras"] = st.number_input(
            "Other Income (Awards, Side Hustle)", value=gross_data["extras"], key="extras", step=100.0
        )
    
    gross_data["total_gross"] = gross_data["base_salary"] + gross_data["bonus"] + gross_data["extras"]
    
    st.metric("Total Gross Income", f"${gross_data['total_gross']:,.2f}")
    
    if st.button("💾 Save Income", key="save_income"):
        user_data["gross_income"] = gross_data
        save_user_data(user_data, username)
        st.rerun()
    
    st.divider()
    
    # Edit pre-tax deductions
    st.subheader("Pre-Tax Deductions")
    
    col1, col2 = st.columns(2)
    
    deductions = user_data["deductions"]
    
    with col1:
        deductions["hsa_annual"] = st.number_input(
            "HSA Contribution (Annual)", value=deductions.get("hsa_annual", 0), key="hsa", step=100.0
        )
    
    with col2:
        deductions["k401_employee_annual"] = st.number_input(
            "401(k) Employee Contribution (Annual)", 
            value=deductions.get("k401_employee_annual", 0), key="k401_emp", step=100.0
        )
    
    if st.button("💾 Save Deductions", key="save_deductions"):
        user_data["deductions"] = deductions
        save_user_data(user_data, username)
        st.rerun()
    
    st.divider()
    
    # Calculate and display tax breakdown
    st.subheader("Tax Calculation (2025)")
    
    gross = gross_data["total_gross"]
    hsa = deductions.get("hsa_annual", 0)
    k401_emp = deductions.get("k401_employee_annual", 0)
    
    tax_info = taxes.calculate_take_home(gross, hsa, k401_emp)
    
    # Display in columns
    col1, col2, col3, col4, col5 = st.columns(5)
    
    with col1:
        st.metric("Federal Tax", f"${tax_info['federal_tax']:,.0f}")
    with col2:
        st.metric("MI Tax", f"${tax_info['michigan_tax']:,.0f}")
    with col3:
        st.metric("Social Security", f"${tax_info['social_security_tax']:,.0f}")
    with col4:
        st.metric("Medicare", f"${tax_info['medicare_tax']:,.0f}")
    with col5:
        st.metric("401k Match", f"${tax_info['k401_employer_match']:,.0f}")
    
    # Summary
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Taxes", f"${tax_info['total_taxes']:,.0f}")
    with col2:
        annual_net = tax_info["net_pay"]
        st.metric("Annual Net Pay", f"${annual_net:,.0f}")
    with col3:
        st.metric("Monthly Net Pay", f"${annual_net/12:,.0f}")
    
    # Show breakdown table
    st.subheader("Detailed Breakdown")
    breakdown_df = pd.DataFrame([
        {"Item": "Gross Income", "Amount": f"${gross:,.0f}"},
        {"Item": "HSA Deduction", "Amount": f"-${hsa:,.0f}"},
        {"Item": "401(k) Employee", "Amount": f"-${k401_emp:,.0f}"},
        {"Item": "Taxable Income", "Amount": f"${tax_info['taxable_income']:,.0f}"},
        {"Item": "Federal Tax", "Amount": f"-${tax_info['federal_tax']:,.0f}"},
        {"Item": "MI Tax", "Amount": f"-${tax_info['michigan_tax']:,.0f}"},
        {"Item": "FICA (SS + Medicare)", "Amount": f"-${tax_info['total_fica']:,.0f}"},
        {"Item": "401(k) Employer Match", "Amount": f"+${tax_info['k401_employer_match']:,.0f}"},
        {"Item": "Net Pay (to your account)", "Amount": f"${annual_net:,.0f}"},
    ])
    
    st.dataframe(breakdown_df, use_container_width=True, hide_index=True)


def tab_expenses():
    """Tab 2: Manage Expenses."""
    st.header("💸 Expenses")
    
    username = st.session_state.current_user
    user_data = load_user_data(username)
    
    expenses = user_data.get("expenses", [])
    
    # Ensure each expense has a unique ID and save if we added any
    ids_added = False
    for exp in expenses:
        if "id" not in exp:
            exp["id"] = str(uuid.uuid4())
            ids_added = True
    
    if ids_added:
        user_data["expenses"] = expenses
        save_user_data(user_data, username)
    
    # Handle deletion if flagged
    if "expense_id_to_delete" in st.session_state and st.session_state.expense_id_to_delete is not None:
        expense_id = st.session_state.expense_id_to_delete
        original_count = len(expenses)
        expenses = [exp for exp in expenses if exp.get("id") != expense_id]
        
        if len(expenses) < original_count:  # Deletion succeeded
            user_data["expenses"] = expenses
            save_user_data(user_data, username)
            st.session_state.expense_id_to_delete = None
            st.rerun()
    
    # Display existing expenses in table
    st.subheader("Current Expenses")
    
    if expenses:
        # Create table with editable fields
        for i, exp in enumerate(expenses):
            col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
            
            with col1:
                exp["name"] = st.text_input("Name", exp["name"], key=f"exp_name_{exp['id']}", label_visibility="collapsed")
            
            with col2:
                exp["amount"] = st.number_input("Amount", value=float(exp["amount"]), key=f"exp_amt_{exp['id']}", label_visibility="collapsed", min_value=0.0, step=100.0)
            
            with col3:
                exp["cadence"] = st.selectbox(
                    "Frequency",
                    ["monthly", "yearly", "one-time"],
                    index=["monthly", "yearly", "one-time"].index(exp.get("cadence", "monthly")),
                    key=f"exp_cad_{exp['id']}",
                    label_visibility="collapsed"
                )
            
            with col4:
                if st.button("🗑️", key=f"del_exp_{exp['id']}"):
                    st.session_state.expense_id_to_delete = exp["id"]
                    st.rerun()
        
        if st.button("💾 Save Changes", key="save_exp"):
            user_data["expenses"] = expenses
            save_user_data(user_data, username)
            st.rerun()
    else:
        st.info("No expenses added yet. Add one below.")
    
    st.divider()
    
    # Add new expense
    st.subheader("Add New Expense")
    
    col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
    
    with col1:
        new_name = st.text_input("Name", placeholder="e.g., Groceries", key="new_exp_name")
    
    with col2:
        new_amount = st.number_input("Amount", value=100.0, min_value=0.0, key="new_exp_amt", step=100.0)
    
    with col3:
        new_cadence = st.selectbox("Frequency", ["monthly", "yearly", "one-time"], key="new_exp_cad")
    
    with col4:
        st.write("")  # Spacer
        st.write("")  # Spacer
        if st.button("➕ Add"):
            if new_name:
                new_exp = {
                    "id": str(uuid.uuid4()),
                    "name": new_name,
                    "amount": new_amount,
                    "cadence": new_cadence,
                    "category": new_name.lower(),
                }
                if new_cadence == "one-time":
                    new_exp["month"] = 1  # Default to month 1
                
                expenses.append(new_exp)
                user_data["expenses"] = expenses
                save_user_data(user_data, username)
                st.rerun()
            else:
                st.warning("Please enter a name")
    
    st.divider()
    
    # Expense impact analysis
    st.subheader("💡 Expense Impact Analysis")
    
    # Calculate current monthly expenses
    current_monthly = budget.get_total_monthly_expenses(expenses)
    
    # Get monthly net income
    monthly_net = budget.get_monthly_net_pay(user_data, include_bonus=False)
    brokerage_monthly = user_data["savings"].get("brokerage_monthly", 0.0)
    
    # Show current financial summary
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Monthly Take-Home Pay", f"${monthly_net:,.0f}")
    
    with col2:
        st.metric("Current Monthly Expenses", f"${current_monthly:,.0f}")
    
    with col3:
        st.metric("Brokerage Contribution", f"${brokerage_monthly:,.0f}")
    
    with col4:
        current_leftover = monthly_net - current_monthly - brokerage_monthly
        st.metric("Current Leftover (to Savings)", f"${current_leftover:,.0f}")
    
    st.divider()
    
    # Slider to adjust expenses
    adjusted_monthly = st.slider(
        "Adjust Monthly Expenses to See Impact",
        min_value=0.0,
        max_value=current_monthly * 2,
        value=current_monthly,
        step=100.0,
        key="expense_slider",
        help="Move slider to see how changing your total monthly expenses affects your finances"
    )
    
    expense_difference = adjusted_monthly - current_monthly
    
    if abs(expense_difference) > 0:
        
        # Show adjusted leftover
        adjusted_leftover = monthly_net - adjusted_monthly - brokerage_monthly
        leftover_difference = adjusted_leftover - current_leftover
        
        st.write("**Adjusted Scenario:**")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            if expense_difference > 0:
                st.metric("Adjusted Monthly Expenses", f"${adjusted_monthly:,.0f}", delta=f"+${expense_difference:,.0f}")
            else:
                st.metric("Adjusted Monthly Expenses", f"${adjusted_monthly:,.0f}", delta=f"${expense_difference:,.0f}")
        
        with col2:
            st.metric("Adjusted Leftover", f"${adjusted_leftover:,.0f}", delta=f"${leftover_difference:,.0f}")
        
        with col3:
            annual_difference = expense_difference * 12
            if expense_difference > 0:
                st.metric("Annual Impact", f"-${annual_difference:,.0f}", delta=f"-${annual_difference:,.0f}")
            else:
                st.metric("Annual Savings", f"+${-annual_difference:,.0f}", delta=f"+${-annual_difference:,.0f}")
        
        st.divider()
        
        # Show impact on accounts
        st.write("**12-Month Impact on Account Balances:**")
        
        # Calculate disposable income difference
        disposable_current = monthly_net - current_monthly - brokerage_monthly
        disposable_adjusted = monthly_net - adjusted_monthly - brokerage_monthly
        disposable_diff = disposable_adjusted - disposable_current
        
        # Project 12-month impact (with interest on savings)
        months = 12
        savings_impact = 0.0
        for month in range(months):
            # Add monthly difference plus interest
            savings_impact = savings_impact * (1 + 0.035/12) + disposable_diff
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric(
                "Savings Account Impact (12mo)",
                f"${savings_impact:,.0f}",
                delta=f"${savings_impact:,.0f}",
                help="How much more/less you'll have in savings after 12 months"
            )
        
        with col2:
            # Brokerage account (if they're still contributing)
            if disposable_adjusted > 0:
                brokerage_impact = 0.0
                for month in range(months):
                    brokerage_impact = brokerage_impact * (1 + 0.08/12)  # Use default 8% growth
                    # Only add if disposable income is positive
                st.metric(
                    "Brokerage Impact (12mo)",
                    f"${brokerage_impact:,.0f}" if brokerage_impact != 0 else "No change",
                    help="Brokerage contributions continue unchanged"
                )
            else:
                st.warning("⚠️ Negative disposable income - budget unsustainable!")
        
        with col3:
            # Total net worth impact
            total_impact = savings_impact
            st.metric(
                "Total Net Worth Impact",
                f"${total_impact:,.0f}",
                delta=f"${total_impact:,.0f}",
                help="Combined impact on all accounts after 12 months"
            )
        
        # Recommendations
        if expense_difference > 0:
            st.warning(f"⚠️ Increasing expenses by ${expense_difference:,.0f}/month will reduce your savings by ${savings_impact:,.0f} over 12 months.")
        else:
            st.success(f"✅ Reducing expenses by ${-expense_difference:,.0f}/month will increase your savings by ${savings_impact:,.0f} over 12 months!")


def _expense_to_monthly(exp: dict) -> float:
    """Convert a single expense to monthly amount (one-time excluded)."""
    amount = exp.get("amount", 0.0)
    cadence = exp.get("cadence", "monthly")
    if cadence == "monthly":
        return amount
    if cadence == "yearly":
        return amount / 12
    return 0.0  # one-time: not recurring


def tab_max_budget():
    """Tab: Max Budget - max amount available for variable expenses given fixed ones."""
    st.header("📐 Max Budget")
    st.caption("See how much you can spend on variable expenses after covering fixed costs.")

    username = st.session_state.current_user
    user_data = load_user_data(username)
    expenses = user_data.get("expenses", [])

    # Session state for fixed/variable per expense (by id)
    if "max_budget_fixed" not in st.session_state:
        st.session_state.max_budget_fixed = {}
    if "max_budget_currency" not in st.session_state:
        st.session_state.max_budget_currency = "USD"
    if "max_budget_usd_per_cad" not in st.session_state:
        st.session_state.max_budget_usd_per_cad = 0.74  # 1 CAD = 0.74 USD

    # --- Currency at top ---
    st.subheader("💱 Currency")
    col_cur, col_rate = st.columns(2)
    with col_cur:
        currency = st.radio(
            "Amounts in",
            options=["USD", "CAD"],
            key="max_budget_currency_radio",
            horizontal=True,
        )
        st.session_state.max_budget_currency = currency
    with col_rate:
        if currency == "CAD":
            # 1 USD = ? CAD
            usd_to_cad = st.number_input(
                "1 USD = (CAD)",
                value=1.35,
                min_value=0.01,
                step=0.01,
                key="max_budget_usd_to_cad",
                help="Conversion rate for reference",
            )
            st.session_state.max_budget_usd_per_cad = 1.0 / usd_to_cad
        else:
            cad_to_usd = st.number_input(
                "1 CAD = (USD)",
                value=0.74,
                min_value=0.01,
                step=0.01,
                key="max_budget_cad_to_usd",
                help="Conversion rate for reference",
            )
            st.session_state.max_budget_usd_per_cad = cad_to_usd
    curr_label = currency
    st.divider()

    # --- Income at top ---
    st.subheader("📥 Monthly Income")
    monthly_net = budget.get_monthly_net_pay(user_data, include_bonus=False)
    income_default = monthly_net if currency == "USD" else monthly_net / st.session_state.max_budget_usd_per_cad
    monthly_income = st.number_input(
        f"Monthly income (after tax, {currency})",
        value=round(income_default, 2),
        min_value=0.0,
        step=500.0,
        key="max_budget_income",
        help="Pre-filled from Income & Taxes tab when in USD.",
    )
    st.metric(f"Monthly income ({curr_label})", f"${monthly_income:,.2f} {curr_label}")
    st.divider()

    # --- Expenses: amount + Fixed checkbox ---
    st.subheader("💸 Expenses (Fixed vs Variable)")
    st.caption("Set each expense amount and check **Fixed** if it must be paid every month. Remaining income is your max for variable spending.")

    if not expenses:
        st.info("Add expenses in the **💸 Expenses** tab first, then come back here to mark them fixed or variable and see your max budget.")
        return

    total_fixed_monthly = 0.0
    total_variable_monthly = 0.0

    for exp in expenses:
        exp_id = exp.get("id", "")
        if not exp_id:
            continue
        monthly_amt = _expense_to_monthly(exp)
        if monthly_amt == 0:
            continue  # skip one-time for this view
        default_fixed = st.session_state.max_budget_fixed.get(exp_id, True)
        col_name, col_amt, col_fixed = st.columns([3, 2, 1])
        with col_name:
            st.text_input("Category", value=exp.get("name", ""), key=f"max_budget_name_{exp_id}", disabled=True, label_visibility="collapsed")
        with col_amt:
            amt = st.number_input(
                "Amount",
                value=round(float(exp.get("amount", 0)), 2),
                min_value=0.0,
                step=50.0,
                key=f"max_budget_amt_{exp_id}",
                label_visibility="collapsed",
            )
            # Normalize to monthly for this row
            cadence = exp.get("cadence", "monthly")
            if cadence == "yearly":
                amt = amt / 12
        with col_fixed:
            is_fixed = st.checkbox("Fixed", value=default_fixed, key=f"max_budget_fixed_{exp_id}")
            st.session_state.max_budget_fixed[exp_id] = is_fixed
        if is_fixed:
            total_fixed_monthly += amt
        else:
            total_variable_monthly += amt

    st.divider()

    # --- Result: max for variable ---
    st.subheader("📊 Result")
    max_for_variable = monthly_income - total_fixed_monthly
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total fixed (monthly)", f"${total_fixed_monthly:,.2f} {curr_label}")
    with col2:
        st.metric("Current variable (monthly)", f"${total_variable_monthly:,.2f} {curr_label}")
    with col3:
        st.metric("Max for variable", f"${max_for_variable:,.2f} {curr_label}")

    if max_for_variable < 0:
        st.error("⚠️ Fixed expenses exceed income. Reduce fixed costs or increase income.")
    else:
        st.success(f"**Maximum you can spend on variable expenses (monthly): ${max_for_variable:,.2f} {curr_label}**")


def tab_savings():
    """Tab 3: Savings & Contributions."""
    st.header("💎 Savings & Contributions")
    
    username = st.session_state.current_user
    user_data = load_user_data(username)
    
    st.subheader("Monthly Post-Tax Contributions")
    
    savings = user_data.get("savings", {})
    savings["brokerage_monthly"] = st.number_input(
        "Brokerage/Investment Account", 
        value=savings.get("brokerage_monthly", 0),
        key="broker_monthly",
        step=100.0
    )
    
    if st.button("💾 Save Contributions", key="save_contrib"):
        user_data["savings"] = savings
        save_user_data(user_data, username)
        st.rerun()
    
    st.divider()
    
    st.subheader("📈 Investment Growth Rates (Annual %)")
    
    st.info("💡 Note: Gains in Savings and Brokerage accounts are taxed at your marginal tax rate. 401(k) grows tax-deferred, HSA grows tax-free.")
    
    growth = user_data.get("investment_growth", {})
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        growth["k401_annual_rate"] = st.number_input(
            "401(k) Annual Return %", 
            value=growth.get("k401_annual_rate", 7.0),
            min_value=0.0,
            max_value=20.0,
            step=0.5,
            key="growth_401",
            help="Typical: 6-10% for diversified index funds"
        )
    
    with col2:
        growth["hsa_annual_rate"] = st.number_input(
            "HSA Annual Return %", 
            value=growth.get("hsa_annual_rate", 5.0),
            min_value=0.0,
            max_value=20.0,
            step=0.5,
            key="growth_hsa",
            help="Typical: 4-7% for conservative to moderate portfolios"
        )
    
    with col3:
        growth["brokerage_annual_rate"] = st.number_input(
            "Brokerage Annual Return %", 
            value=growth.get("brokerage_annual_rate", 8.0),
            min_value=0.0,
            max_value=20.0,
            step=0.5,
            key="growth_brokerage",
            help="Typical: 7-10% for stock-heavy portfolios"
        )
    
    st.caption("💰 Savings account: Fixed 3.5% APY (taxed)")
    
    if st.button("💾 Save Growth Rates", key="save_growth"):
        user_data["investment_growth"] = growth
        save_user_data(user_data, username)
        st.rerun()
    
    st.divider()
    
    st.subheader("Current Account Balances")
    
    balances = user_data.get("account_balances", {})
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        balances["savings"] = st.number_input("Savings Account", value=balances.get("savings", 0), key="bal_sav", step=100.0)
    with col2:
        balances["k401"] = st.number_input("401(k)", value=balances.get("k401", 0), key="bal_401", step=100.0)
    with col3:
        balances["hsa"] = st.number_input("HSA", value=balances.get("hsa", 0), key="bal_hsa", step=100.0)
    with col4:
        balances["brokerage"] = st.number_input("Brokerage", value=balances.get("brokerage", 0), key="bal_bro", step=100.0)
    
    if st.button("💾 Save Balances", key="save_bal"):
        user_data["account_balances"] = balances
        save_user_data(user_data, username)
        st.rerun()


def tab_scenarios():
    """Tab 4: One-Time Expense Scenarios."""
    st.header("🔮 What-If: One-Time Expenses")
    
    st.info("💡 Test how major one-time purchases affect your projections. These are saved to your profile.")
    
    username = st.session_state.current_user
    user_data = load_user_data(username)
    
    # Load scenario expenses from user data (persistent)
    scenario_expenses = user_data.get("scenario_expenses", [])
    
    # Ensure all expenses have IDs
    for exp in scenario_expenses:
        if "id" not in exp:
            exp["id"] = str(uuid.uuid4())
    
    # Handle deletion if flagged
    if "scenario_expense_id_to_delete" in st.session_state and st.session_state.scenario_expense_id_to_delete is not None:
        expense_id = st.session_state.scenario_expense_id_to_delete
        scenario_expenses = [exp for exp in scenario_expenses if exp.get("id") != expense_id]
        user_data["scenario_expenses"] = scenario_expenses
        save_user_data(user_data, username)
        st.session_state.scenario_expense_id_to_delete = None
        st.rerun()
    
    # Display scenario expenses
    st.subheader("Scenario Expenses")
    
    if scenario_expenses:
        for i, exp in enumerate(scenario_expenses):
            col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
            
            with col1:
                exp["name"] = st.text_input("Name", exp["name"], key=f"scen_name_{exp['id']}", label_visibility="collapsed")
            
            with col2:
                exp["amount"] = st.number_input("Amount", value=float(exp["amount"]), key=f"scen_amt_{exp['id']}", label_visibility="collapsed", min_value=0.0, step=100.0)
            
            with col3:
                exp["month"] = st.number_input("Month", value=int(exp.get("month", 1)), key=f"scen_month_{exp['id']}", label_visibility="collapsed", min_value=1, max_value=60, step=1)
            
            with col4:
                if st.button("🗑️", key=f"del_scen_{exp['id']}"):
                    st.session_state.scenario_expense_id_to_delete = exp["id"]
                    st.rerun()
        
        if st.button("💾 Save Changes", key="save_scenario_changes"):
            user_data["scenario_expenses"] = scenario_expenses
            save_user_data(user_data, username)
            st.success("✅ Scenario expenses saved!")
            st.rerun()
    else:
        st.info("No scenario expenses added. Add one below to see the impact.")
    
    st.divider()
    
    # Add new scenario expense
    st.subheader("Add Scenario Expense")
    
    col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
    
    with col1:
        new_name = st.text_input("Name", placeholder="e.g., New Car, Home Renovation", key="new_scen_name")
    
    with col2:
        new_amount = st.number_input("Amount", value=10000.0, min_value=0.0, key="new_scen_amt", step=1000.0)
    
    with col3:
        new_month = st.number_input("Month", value=1, min_value=1, max_value=60, step=1, key="new_scen_month", help="Which month this expense occurs")
    
    with col4:
        st.write("")  # Spacer
        st.write("")  # Spacer
        if st.button("➕ Add", key="add_scenario"):
            if new_name:
                new_exp = {
                    "id": str(uuid.uuid4()),
                    "name": new_name,
                    "amount": new_amount,
                    "cadence": "one-time",
                    "category": new_name.lower(),
                    "month": new_month,
                }
                scenario_expenses.append(new_exp)
                user_data["scenario_expenses"] = scenario_expenses
                save_user_data(user_data, username)
                st.rerun()
            else:
                st.warning("Please enter a name")
    
    st.divider()
    
    # Run projection with scenarios
    if scenario_expenses:
        st.subheader("📊 Projection with Scenarios")
        
        months = st.slider("Projection months", 6, 60, 12, key="scen_months")
        
        try:
            # Project with scenarios
            projection_df = budget.project_accounts(username, months, scenario_expenses=scenario_expenses)
            
            # Display impact
            st.subheader(f"Impact on Ending Balances (Month {months})")
            
            last_row = projection_df.iloc[-1]
            
            # Get baseline (without scenarios)
            baseline_df = budget.project_accounts(username, months, scenario_expenses=None)
            baseline_row = baseline_df.iloc[-1]
            
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                delta = last_row['savings_balance'] - baseline_row['savings_balance']
                st.metric("Savings", f"${last_row['savings_balance']:,.0f}", delta=f"${delta:,.0f}")
            
            with col2:
                delta = last_row['k401_balance'] - baseline_row['k401_balance']
                st.metric("401(k)", f"${last_row['k401_balance']:,.0f}", delta=f"${delta:,.0f}")
            
            with col3:
                delta = last_row['hsa_balance'] - baseline_row['hsa_balance']
                st.metric("HSA", f"${last_row['hsa_balance']:,.0f}", delta=f"${delta:,.0f}")
            
            with col4:
                delta = last_row['brokerage_balance'] - baseline_row['brokerage_balance']
                st.metric("Brokerage", f"${last_row['brokerage_balance']:,.0f}", delta=f"${delta:,.0f}")
            
            st.divider()
            
            # Show chart comparison
            st.subheader("Account Balance Comparison")
            
            chart_data = pd.DataFrame({
                "Month": projection_df["month"],
                "Savings (Scenario)": projection_df["savings_balance"],
                "Savings (Baseline)": baseline_df["savings_balance"],
                "401k (Scenario)": projection_df["k401_balance"],
                "401k (Baseline)": baseline_df["k401_balance"],
                "HSA (Scenario)": projection_df["hsa_balance"],
                "HSA (Baseline)": baseline_df["hsa_balance"],
                "Brokerage (Scenario)": projection_df["brokerage_balance"],
                "Brokerage (Baseline)": baseline_df["brokerage_balance"],
            })
            
            st.line_chart(chart_data.set_index("Month"))
            
        except Exception as e:
            st.error(f"Error generating projection: {e}")


def tab_projections():
    """Tab 5: Account Projections."""
    st.header("📈 Account Projections")
    
    username = st.session_state.current_user
    
    # Projection timeframe
    months = st.slider("Projection months", 6, 60, 12)
    
    try:
        projection_df = budget.project_accounts(username, months)
        
        # Display key metrics
        st.subheader("Ending Balances (Month {})".format(months))
        
        last_row = projection_df.iloc[-1]
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("Savings", f"${last_row['savings_balance']:,.0f}")
        with col2:
            st.metric("401(k)", f"${last_row['k401_balance']:,.0f}")
        with col3:
            st.metric("HSA", f"${last_row['hsa_balance']:,.0f}")
        with col4:
            st.metric("Brokerage", f"${last_row['brokerage_balance']:,.0f}")
        
        st.divider()
        
        # Projection table
        st.subheader("Monthly Projection")
        
        display_df = projection_df.copy()
        
        # Format columns
        for col in ["monthly_net_income", "monthly_expenses", "one_time_expenses", "brokerage_contribution", "disposable_income", "savings_balance", "k401_balance", "hsa_balance", "brokerage_balance"]:
            display_df[col] = display_df[col].apply(lambda x: f"${x:,.0f}")
        
        display_df = display_df[[
            "month", "date", "monthly_net_income", "monthly_expenses", 
            "one_time_expenses", "brokerage_contribution", "disposable_income",
            "savings_balance", "k401_balance", "hsa_balance", "brokerage_balance"
        ]].rename(columns={
            "month": "Mo", "date": "Date", "monthly_net_income": "Income", 
            "monthly_expenses": "Expenses", "one_time_expenses": "One-Time",
            "brokerage_contribution": "Broker Contrib", "disposable_income": "Disposable",
            "savings_balance": "Savings", "k401_balance": "401k", 
            "hsa_balance": "HSA", "brokerage_balance": "Brokerage"
        })
        
        st.dataframe(display_df, use_container_width=True, height=500)
        
        st.divider()
        
        # Charts
        st.subheader("Balance Trends")
        
        # Individual Savings Account Balance Chart
        st.write("**Savings Account Balance**")
        savings_chart = projection_df[["month", "savings_balance"]].copy()
        savings_chart = savings_chart.rename(columns={"savings_balance": "Savings Balance ($)"})
        st.line_chart(savings_chart.set_index("month"))
        
        st.divider()
        
        # All accounts together
        st.write("**All Account Balances**")
        chart_df = projection_df[["date", "savings_balance", "k401_balance", "hsa_balance", "brokerage_balance"]].copy()
        chart_df["date"] = pd.to_datetime(chart_df["date"])
        chart_df = chart_df.set_index("date")
        chart_df = chart_df.rename(columns={
            "savings_balance": "Savings",
            "k401_balance": "401(k)",
            "hsa_balance": "HSA",
            "brokerage_balance": "Brokerage"
        })
        
        st.line_chart(chart_df)
        
    except Exception as e:
        st.error(f"Error generating projection: {e}")
        st.write(f"Debug: {str(e)}")


def tab_home_loan():
    """Tab 6: Home Loan in India."""
    st.header("🏠 Home Loan (India)")
    
    username = st.session_state.current_user
    user_data = load_user_data(username)
    
    # Get or initialize loan data
    loan_data = user_data.get("home_loan_india", {
        "principal": 5000000.0,
        "annual_rate": 8.5,
        "term_months": 240,
        "current_balance": 5000000.0,
        "start_date": "2024-01",
        "extra_payment": 0.0,
        "one_time_payments": [],
        "fx_rate": 90.0
    })
    
    # Ensure one_time_payments exists and has IDs
    if "one_time_payments" not in loan_data:
        loan_data["one_time_payments"] = []
    
    if "fx_rate" not in loan_data:
        loan_data["fx_rate"] = 90.0
    
    for payment in loan_data["one_time_payments"]:
        if "id" not in payment:
            payment["id"] = str(uuid.uuid4())
    
    st.info("💡 Loan payments come from your Savings account. Make sure to include 'Home loan' and 'Home Loan extra' in your Expenses tab.")
    
    # FX Rate
    st.subheader("💱 Exchange Rate")
    
    col1, col2 = st.columns([1, 3])
    
    with col1:
        loan_data["fx_rate"] = st.number_input(
            "Current USD/INR Rate",
            value=loan_data.get("fx_rate", 90.0),
            min_value=50.0,
            max_value=150.0,
            step=0.5,
            key="fx_rate",
            help="1 USD = X INR. Your income is in USD, loan is in INR"
        )
    
    with col2:
        st.metric(
            "Your Loan Balance in USD",
            f"${loan_data.get('current_balance', 0) / loan_data['fx_rate']:,.0f}",
            help="Current outstanding balance converted to USD"
        )
    
    st.divider()
    
    # Loan Details
    st.subheader("Loan Details")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        loan_data["principal"] = st.number_input(
            "Original Loan Amount (₹)",
            value=loan_data.get("principal", 5000000.0),
            min_value=0.0,
            step=100000.0,
            key="loan_principal",
            help="Original loan amount in Indian Rupees"
        )
    
    with col2:
        loan_data["annual_rate"] = st.number_input(
            "Annual Interest Rate (%)",
            value=loan_data.get("annual_rate", 8.5),
            min_value=0.0,
            max_value=20.0,
            step=0.1,
            key="loan_rate",
            help="Annual interest rate percentage"
        )
    
    with col3:
        loan_data["term_months"] = st.number_input(
            "Loan Term (Months)",
            value=loan_data.get("term_months", 240),
            min_value=12,
            max_value=360,
            step=12,
            key="loan_term",
            help="Total loan term in months (e.g., 240 months = 20 years)"
        )
    
    col1, col2 = st.columns(2)
    
    with col1:
        loan_data["current_balance"] = st.number_input(
            "Current Outstanding Balance (₹)",
            value=loan_data.get("current_balance", loan_data["principal"]),
            min_value=0.0,
            step=10000.0,
            key="loan_balance",
            help="How much you still owe"
        )
    
    with col2:
        loan_data["extra_payment"] = st.number_input(
            "Extra Monthly Payment (₹)",
            value=loan_data.get("extra_payment", 0.0),
            min_value=0.0,
            step=5000.0,
            key="loan_extra",
            help="Additional amount to pay each month towards principal"
        )
    
    if st.button("💾 Save Loan Details", key="save_loan"):
        user_data["home_loan_india"] = loan_data
        save_user_data(user_data, username)
        st.rerun()
    
    st.divider()
    
    # One-time extra payments section
    st.subheader("💵 One-Time Extra Payments")
    
    # Handle deletion if flagged
    if "loan_payment_id_to_delete" in st.session_state and st.session_state.loan_payment_id_to_delete is not None:
        payment_id = st.session_state.loan_payment_id_to_delete
        loan_data["one_time_payments"] = [p for p in loan_data["one_time_payments"] if p.get("id") != payment_id]
        user_data["home_loan_india"] = loan_data
        save_user_data(user_data, username)
        st.session_state.loan_payment_id_to_delete = None
        st.rerun()
    
    if loan_data["one_time_payments"]:
        st.write("**Scheduled One-Time Payments:**")
        for payment in loan_data["one_time_payments"]:
            col1, col2, col3 = st.columns([2, 2, 1])
            
            with col1:
                payment["month"] = st.number_input(
                    "Month",
                    value=payment.get("month", 1),
                    min_value=1,
                    max_value=360,
                    step=1,
                    key=f"loan_payment_month_{payment['id']}",
                    label_visibility="collapsed"
                )
            
            with col2:
                payment["amount"] = st.number_input(
                    "Amount (₹)",
                    value=payment.get("amount", 10000.0),
                    min_value=0.0,
                    step=5000.0,
                    key=f"loan_payment_amt_{payment['id']}",
                    label_visibility="collapsed"
                )
            
            with col3:
                if st.button("🗑️", key=f"del_loan_payment_{payment['id']}"):
                    st.session_state.loan_payment_id_to_delete = payment["id"]
                    st.rerun()
        
        if st.button("💾 Save One-Time Payments", key="save_one_time"):
            user_data["home_loan_india"] = loan_data
            save_user_data(user_data, username)
            st.rerun()
    else:
        st.info("No one-time extra payments scheduled. Add one below.")
    
    # Add new one-time payment
    col1, col2, col3 = st.columns([2, 2, 1])
    
    with col1:
        new_payment_month = st.number_input(
            "Payment Month",
            value=1,
            min_value=1,
            max_value=360,
            step=1,
            key="new_loan_payment_month",
            help="Month number when you'll make this payment"
        )
    
    with col2:
        new_payment_amount = st.number_input(
            "Payment Amount (₹)",
            value=50000.0,
            min_value=0.0,
            step=10000.0,
            key="new_loan_payment_amt"
        )
    
    with col3:
        st.write("")
        st.write("")
        if st.button("➕ Add One-Time Payment", key="add_one_time_payment"):
            new_payment = {
                "id": str(uuid.uuid4()),
                "month": new_payment_month,
                "amount": new_payment_amount
            }
            loan_data["one_time_payments"].append(new_payment)
            user_data["home_loan_india"] = loan_data
            save_user_data(user_data, username)
            st.rerun()
    
    st.divider()
    
    # Calculate EMI
    try:
        monthly_payment = loan.calculate_monthly_payment(
            loan_data["current_balance"],
            loan_data["annual_rate"],
            loan_data["term_months"]
        )
        
        st.subheader("Payment Summary")
        
        col1, col2, col3, col4 = st.columns(4)
        
        total_monthly_inr = monthly_payment + loan_data['extra_payment']
        total_monthly_usd = total_monthly_inr / loan_data["fx_rate"]
        
        with col1:
            st.metric("Monthly EMI (₹)", f"₹{monthly_payment:,.0f}")
            st.caption(f"${monthly_payment / loan_data['fx_rate']:,.0f} USD")
        
        with col2:
            st.metric("Extra Payment (₹)", f"₹{loan_data['extra_payment']:,.0f}")
            st.caption(f"${loan_data['extra_payment'] / loan_data['fx_rate']:,.0f} USD")
        
        with col3:
            st.metric("Total Monthly (₹)", f"₹{total_monthly_inr:,.0f}")
            st.caption(f"${total_monthly_usd:,.0f} USD")
        
        with col4:
            # Show as % of income
            user_data_temp = load_user_data(username)
            monthly_net = budget.get_monthly_net_pay(user_data_temp)
            pct_of_income = (total_monthly_usd / monthly_net * 100) if monthly_net > 0 else 0
            st.metric("% of Net Income", f"{pct_of_income:.1f}%")
            st.caption(f"${monthly_net:,.0f} monthly net")
        
        st.divider()
        
        # Impact of Extra Payments
        if loan_data["extra_payment"] > 0 or loan_data["one_time_payments"]:
            st.subheader("💰 Impact of Extra Payments")
            
            # Convert one-time payments list to dict
            one_time_dict = {p["month"]: p["amount"] for p in loan_data["one_time_payments"]}
            
            savings_data = loan.calculate_loan_savings(
                loan_data["current_balance"],
                loan_data["annual_rate"],
                loan_data["term_months"],
                loan_data["extra_payment"],
                one_time_dict
            )
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.write("**Without Extra Payment:**")
                st.metric("Payoff Time", f"{savings_data['baseline']['years']:.1f} years")
                st.metric("Total Interest", f"₹{savings_data['baseline']['total_interest']:,.0f}")
                st.metric("Total Paid", f"₹{savings_data['baseline']['total_paid']:,.0f}")
            
            with col2:
                st.write("**With Extra Payment:**")
                st.metric("Payoff Time", f"{savings_data['with_extra']['years']:.1f} years")
                st.metric("Total Interest", f"₹{savings_data['with_extra']['total_interest']:,.0f}")
                st.metric("Total Paid", f"₹{savings_data['with_extra']['total_paid']:,.0f}")
            
            st.divider()
            
            st.subheader("✨ Your Savings")
            
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("Time Saved", f"{savings_data['savings']['years_saved']:.1f} years")
            
            with col2:
                st.metric("Interest Saved", f"₹{savings_data['savings']['interest_saved']:,.0f}")
            
            with col3:
                usd_saved = savings_data['savings']['interest_saved'] / 83
                st.metric("Interest Saved (USD)", f"${usd_saved:,.0f}")
        
        st.divider()
        
        # Amortization Schedule
        st.subheader("📊 Amortization Schedule")
        
        # Convert one-time payments list to dict
        one_time_dict = {p["month"]: p["amount"] for p in loan_data["one_time_payments"]}
        
        schedule_df = loan.generate_amortization_schedule(
            loan_data["current_balance"],
            loan_data["annual_rate"],
            loan_data["term_months"],
            loan_data["extra_payment"],
            one_time_dict
        )
        
        # Show first 12 months and last 12 months
        st.write("**First Year:**")
        display_first = schedule_df.head(12).copy()
        for col in ["payment", "principal_payment", "interest_payment", "extra_payment", "total_payment", "balance", "total_interest_paid"]:
            display_first[col] = display_first[col].apply(lambda x: f"₹{x:,.0f}")
        st.dataframe(display_first, use_container_width=True, hide_index=True)
        
        if len(schedule_df) > 24:
            st.write(f"**... ({len(schedule_df) - 24} months omitted) ...**")
        
        st.write("**Final Year:**")
        display_last = schedule_df.tail(12).copy()
        for col in ["payment", "principal_payment", "interest_payment", "extra_payment", "total_payment", "balance", "total_interest_paid"]:
            display_last[col] = display_last[col].apply(lambda x: f"₹{x:,.0f}")
        st.dataframe(display_last, use_container_width=True, hide_index=True)
        
        # Show full schedule option
        with st.expander("📋 View Full Amortization Schedule"):
            display_full = schedule_df.copy()
            for col in ["payment", "principal_payment", "interest_payment", "extra_payment", "total_payment", "balance", "total_interest_paid"]:
                display_full[col] = display_full[col].apply(lambda x: f"₹{x:,.0f}")
            st.dataframe(display_full, use_container_width=True, height=600)
        
        st.divider()
        
        # Balance over time chart
        st.subheader("📈 Loan Balance Over Time")
        
        chart_data = schedule_df[["month", "balance"]].copy()
        chart_data = chart_data.rename(columns={"balance": "Outstanding Balance (₹)"})
        st.line_chart(chart_data.set_index("month"))
        
        st.divider()
        
        # FX Rate Sensitivity Analysis
        st.subheader("💱 FX Rate Impact Analysis")
        
        st.info("💡 Since you earn in USD but your loan is in INR, exchange rate changes affect how much of your USD income goes to loan payments.")
        
        # Calculate monthly payment in USD at different rates
        total_monthly_inr = monthly_payment + loan_data['extra_payment']
        current_rate = loan_data["fx_rate"]
        
        # FX scenarios
        fx_scenarios = {
            "INR Strengthens (-10%)": current_rate * 0.9,
            "INR Strengthens (-5%)": current_rate * 0.95,
            "Current Rate": current_rate,
            "INR Weakens (+5%)": current_rate * 1.05,
            "INR Weakens (+10%)": current_rate * 1.10,
        }
        
        st.write("**Monthly Payment Impact at Different Exchange Rates:**")
        
        # Create comparison table
        fx_comparison = []
        for scenario, rate in fx_scenarios.items():
            payment_usd = total_monthly_inr / rate
            balance_usd = loan_data["current_balance"] / rate
            
            # Calculate percentage of typical monthly net income (assume $10k/month)
            user_data_temp = load_user_data(username)
            monthly_net = budget.get_monthly_net_pay(user_data_temp)
            pct_of_income = (payment_usd / monthly_net * 100) if monthly_net > 0 else 0
            
            fx_comparison.append({
                "Scenario": scenario,
                "FX Rate (USD/INR)": f"{rate:.2f}",
                "Monthly Payment (USD)": f"${payment_usd:,.0f}",
                "% of Net Income": f"{pct_of_income:.1f}%",
                "Total Balance (USD)": f"${balance_usd:,.0f}",
            })
        
        comparison_df = pd.DataFrame(fx_comparison)
        st.dataframe(comparison_df, use_container_width=True, hide_index=True)
        
        st.divider()
        
        # Visual comparison
        st.subheader("📊 Payment Sensitivity to FX Rate")
        
        # Generate range of FX rates
        fx_range = list(range(int(current_rate * 0.8), int(current_rate * 1.2) + 1))
        payment_usd_range = [total_monthly_inr / fx for fx in fx_range]
        
        chart_df = pd.DataFrame({
            "FX Rate (USD/INR)": fx_range,
            "Monthly Payment (USD)": payment_usd_range
        })
        
        st.line_chart(chart_df.set_index("FX Rate (USD/INR)"))
        
        # Key insights
        st.subheader("💡 Key Insights")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.write("**If INR Strengthens (rate decreases):**")
            st.write("✅ Your USD payments increase (worse for you)")
            st.write("✅ Fewer rupees per dollar means higher USD cost")
            st.write("✅ Consider accelerating payments when INR is weak")
        
        with col2:
            st.write("**If INR Weakens (rate increases):**")
            st.write("✅ Your USD payments decrease (better for you)")
            st.write("✅ More rupees per dollar means lower USD cost")
            st.write("✅ Good time to make extra payments")
        
        st.divider()
        
        # Strategy recommendations
        st.subheader("🎯 Strategy Recommendations")
        
        current_payment_usd = total_monthly_inr / current_rate
        current_pct = (current_payment_usd / monthly_net * 100) if monthly_net > 0 else 0
        
        if current_pct < 10:
            st.success(f"✅ Your loan payment is {current_pct:.1f}% of net income - very manageable. Consider aggressive prepayment.")
        elif current_pct < 20:
            st.info(f"ℹ️ Your loan payment is {current_pct:.1f}% of net income - moderate burden. Watch FX trends for prepayment opportunities.")
        else:
            st.warning(f"⚠️ Your loan payment is {current_pct:.1f}% of net income - significant burden. FX risk is material to your budget.")
        
        # FX hedging options
        with st.expander("🛡️ Managing FX Risk"):
            st.write("""
            **Options to reduce FX exposure:**
            
            1. **Time Your Payments**: Make extra payments when INR is weak (high rate)
            
            2. **Set Up Rupee Reserves**: Keep some savings in INR to buffer against rate changes
            
            3. **Fixed Conversion Schedule**: Convert fixed USD amounts monthly regardless of rate (dollar-cost averaging)
            
            4. **Early Payoff Focus**: The faster you pay off the loan, the less time for FX fluctuations to impact you
            
            5. **Monitor Trends**: Track USD/INR trends and make lump sum payments during favorable periods
            
            **Current Loan Exposure:**
            - Balance in USD: ${:,.0f}
            - Months remaining: ~{} months
            - Total FX exposure: This balance will be converted over the loan term
            """.format(
                loan_data["current_balance"] / current_rate,
                len(schedule_df)
            ))
        
    except Exception as e:
        st.error(f"Error calculating loan: {e}")


def tab_investment_strategies():
    """Tab: Investment Strategy Analysis - HSA and 401k optimization."""
    st.header("📊 Investment Strategy Analysis")
    
    username = st.session_state.current_user
    user_data = load_user_data(username)
    
    try:
        # Get current account balances and contribution rates
        accounts = user_data.get("account_balances", {})
        savings_data = user_data.get("savings", {})
        investment_growth = user_data.get("investment_growth", {})
        deductions = user_data.get("deductions", {})
        
        current_hsa_balance = accounts.get("hsa", 0)
        current_k401_balance = accounts.get("k401", 0)
        
        hsa_annual_contrib = deductions.get("hsa_annual", 0)
        k401_annual_contrib = deductions.get("k401_employee_annual", 0)
        
        # Get company match info for 401k
        gross = user_data["gross_income"]["total_gross"]
        tax_info = taxes.calculate_take_home(gross, hsa_annual_contrib, k401_annual_contrib)
        company_match = tax_info['k401_employer_match']
        
        # HSA Analysis Section
        st.header("🏥 HSA Distribution Strategy")
        st.write("Compare taking HSA distributions now vs. waiting and letting it grow tax-free.")
        
        col1, col2 = st.columns(2)
        
        with col1:
            hsa_years_wait = st.slider(
                "Years Until Distribution",
                min_value=0,
                max_value=40,
                value=10,
                step=1,
                help="How many years to wait before taking HSA distributions"
            )
        
        with col2:
            hsa_return_rate = st.slider(
                "Expected Annual Return (%)",
                min_value=0.0,
                max_value=15.0,
                value=investment_growth.get("hsa_annual_growth", 5.0),
                step=0.5,
                help="Expected annual growth rate for HSA investments"
            )
        
        # Calculate HSA scenarios
        st.subheader("📈 HSA Balance Projection")
        
        # Scenario A: Take distribution now (balance stops growing, but contributions continue)
        hsa_now_balance = current_hsa_balance
        hsa_now_contributions = hsa_annual_contrib * hsa_years_wait
        hsa_now_total = hsa_now_balance + hsa_now_contributions
        
        # Scenario B: Wait N years (everything grows)
        years_list = list(range(hsa_years_wait + 1))
        hsa_wait_balances = []
        
        balance = current_hsa_balance
        for year in years_list:
            hsa_wait_balances.append(balance)
            if year < hsa_years_wait:
                # Add contribution and growth
                balance = (balance + hsa_annual_contrib) * (1 + hsa_return_rate / 100)
        
        hsa_wait_final = hsa_wait_balances[-1]
        
        # Display comparison
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("Current HSA Balance", f"${current_hsa_balance:,.0f}")
        
        with col2:
            st.metric(
                "Distribute Now Strategy",
                f"${hsa_now_total:,.0f}",
                help="Current balance + future contributions (no growth)"
            )
        
        with col3:
            st.metric(
                f"Wait {hsa_years_wait} Years Strategy",
                f"${hsa_wait_final:,.0f}",
                delta=f"+${hsa_wait_final - hsa_now_total:,.0f}",
                help="Balance grows tax-free with contributions"
            )
        
        # Chart
        hsa_chart_df = pd.DataFrame({
            "Year": years_list,
            "Wait Strategy (Tax-Free Growth)": hsa_wait_balances,
            "Distribute Now (No Growth)": [current_hsa_balance + hsa_annual_contrib * y for y in years_list]
        })
        
        st.line_chart(hsa_chart_df.set_index("Year"))
        
        # Key insights
        benefit = hsa_wait_final - hsa_now_total
        if benefit > 0:
            st.success(f"💰 **Benefit of Waiting:** ${benefit:,.0f} additional tax-free growth over {hsa_years_wait} years")
            st.info("🔑 **Key Advantage:** HSA grows tax-free and distributions for qualified medical expenses are tax-free. After age 65, you can use HSA funds for non-medical expenses (taxed as ordinary income, like a traditional IRA).")
        
        st.divider()
        
        # 401k Analysis Section
        st.header("📊 401(k) Contribution Strategy")
        st.write("Compare maxing out 401(k) early vs. doing company match first then maxing later.")
        
        # Current 401k max limit (2025)
        k401_max_annual = 23500
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            strategy_switch_years = st.slider(
                "Years Before Strategy Switch",
                min_value=1,
                max_value=30,
                value=10,
                step=1,
                help="When to switch contribution strategies"
            )
        
        with col2:
            total_projection_years = st.slider(
                "Total Years to Project",
                min_value=strategy_switch_years + 1,
                max_value=40,
                value=max(20, strategy_switch_years + 5),
                step=1,
                help="How many years total to project portfolio growth"
            )
        
        with col3:
            k401_return_rate = st.slider(
                "Expected 401(k) Return (%)",
                min_value=0.0,
                max_value=15.0,
                value=investment_growth.get("k401_annual_growth", 7.0),
                step=0.5,
                help="Expected annual growth rate for 401(k) investments"
            )
        
        # Calculate match-only contribution (assume 6% match)
        match_only_contrib = company_match  # This is already the annual employer match
        # Estimate employee contribution that gets match (typically 6% of gross)
        estimated_employee_match_contrib = gross * 0.06
        
        st.subheader("📈 401(k) Strategy Comparison")
        
        # Strategy A: Max out for N years, then reduce to match-only
        strategy_a_name = f"Max {strategy_switch_years}yr → Match After"
        years_list_k401 = list(range(total_projection_years + 1))
        strategy_a_balances = []
        strategy_a_contributions = []
        
        balance_a = current_k401_balance
        for year in years_list_k401:
            strategy_a_balances.append(balance_a)
            
            if year < total_projection_years:
                if year < strategy_switch_years:
                    # Max out employee contribution
                    employee_contrib = k401_max_annual
                    employer_contrib = company_match
                else:
                    # Reduce to match-only
                    employee_contrib = estimated_employee_match_contrib
                    employer_contrib = company_match
                
                total_contrib = employee_contrib + employer_contrib
                strategy_a_contributions.append(total_contrib)
                balance_a = (balance_a + total_contrib) * (1 + k401_return_rate / 100)
        
        # Strategy B: Match-only for N years, then max out
        strategy_b_name = f"Match {strategy_switch_years}yr → Max After"
        strategy_b_balances = []
        strategy_b_contributions = []
        
        balance_b = current_k401_balance
        for year in years_list_k401:
            strategy_b_balances.append(balance_b)
            
            if year < total_projection_years:
                if year < strategy_switch_years:
                    # Match-only
                    employee_contrib = estimated_employee_match_contrib
                    employer_contrib = company_match
                else:
                    # Max out
                    employee_contrib = k401_max_annual
                    employer_contrib = company_match
                
                total_contrib = employee_contrib + employer_contrib
                strategy_b_contributions.append(total_contrib)
                balance_b = (balance_b + total_contrib) * (1 + k401_return_rate / 100)
        
        # Strategy C: Always max out
        strategy_c_name = "Always Max Out"
        strategy_c_balances = []
        strategy_c_contributions = []
        
        balance_c = current_k401_balance
        for year in years_list_k401:
            strategy_c_balances.append(balance_c)
            
            if year < total_projection_years:
                # Always max out
                employee_contrib = k401_max_annual
                employer_contrib = company_match
                
                total_contrib = employee_contrib + employer_contrib
                strategy_c_contributions.append(total_contrib)
                balance_c = (balance_c + total_contrib) * (1 + k401_return_rate / 100)
        
        # Strategy D: Always match-only
        strategy_d_name = "Always Match Only"
        strategy_d_balances = []
        strategy_d_contributions = []
        
        balance_d = current_k401_balance
        for year in years_list_k401:
            strategy_d_balances.append(balance_d)
            
            if year < total_projection_years:
                # Always match-only
                employee_contrib = estimated_employee_match_contrib
                employer_contrib = company_match
                
                total_contrib = employee_contrib + employer_contrib
                strategy_d_contributions.append(total_contrib)
                balance_d = (balance_d + total_contrib) * (1 + k401_return_rate / 100)
        
        # Display comparison
        final_a = strategy_a_balances[-1]
        final_b = strategy_b_balances[-1]
        final_c = strategy_c_balances[-1]
        final_d = strategy_d_balances[-1]
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("Current 401(k) Balance", f"${current_k401_balance:,.0f}")
        
        with col2:
            st.metric(
                strategy_a_name,
                f"${final_a:,.0f}",
                help=f"Max out ${k401_max_annual:,}/yr for {strategy_switch_years} years, then reduce"
            )
        
        with col3:
            difference = final_a - final_b
            st.metric(
                strategy_b_name,
                f"${final_b:,.0f}",
                delta=f"${difference:,.0f}" if difference != 0 else "Same",
                delta_color="inverse",
                help=f"Match-only for {strategy_switch_years} years, then max out"
            )
        
        with col4:
            st.metric(
                strategy_c_name,
                f"${final_c:,.0f}",
                delta=f"+${final_c - final_a:,.0f}",
                help=f"Max out ${k401_max_annual:,}/yr every year"
            )
        
        # Second row for Always Match
        col1, col2 = st.columns([1, 1])
        with col1:
            st.metric(
                strategy_d_name,
                f"${final_d:,.0f}",
                delta=f"${final_d - final_c:,.0f}",
                delta_color="inverse",
                help=f"Match-only every year"
            )
        
        # Chart
        k401_chart_df = pd.DataFrame({
            "Year": years_list_k401,
            strategy_a_name: strategy_a_balances,
            strategy_b_name: strategy_b_balances,
            strategy_c_name: strategy_c_balances,
            strategy_d_name: strategy_d_balances
        })
        
        st.line_chart(k401_chart_df.set_index("Year"))
        
        # Detailed comparison table
        st.subheader("📋 Detailed Comparison")
        
        total_contrib_a = sum(strategy_a_contributions)
        total_contrib_b = sum(strategy_b_contributions)
        total_contrib_c = sum(strategy_c_contributions)
        total_contrib_d = sum(strategy_d_contributions)
        
        comparison_data = {
            "Metric": [
                "Starting Balance",
                f"Total Contributions (Employee + Employer)",
                f"Final Balance (Year {total_projection_years})",
                "Total Growth",
                "Growth Rate"
            ],
            strategy_a_name: [
                f"${current_k401_balance:,.0f}",
                f"${total_contrib_a:,.0f}",
                f"${final_a:,.0f}",
                f"${final_a - current_k401_balance - total_contrib_a:,.0f}",
                f"{((final_a / (current_k401_balance + total_contrib_a + 0.01) - 1) * 100):.1f}%"
            ],
            strategy_b_name: [
                f"${current_k401_balance:,.0f}",
                f"${total_contrib_b:,.0f}",
                f"${final_b:,.0f}",
                f"${final_b - current_k401_balance - total_contrib_b:,.0f}",
                f"{((final_b / (current_k401_balance + total_contrib_b + 0.01) - 1) * 100):.1f}%"
            ],
            strategy_c_name: [
                f"${current_k401_balance:,.0f}",
                f"${total_contrib_c:,.0f}",
                f"${final_c:,.0f}",
                f"${final_c - current_k401_balance - total_contrib_c:,.0f}",
                f"{((final_c / (current_k401_balance + total_contrib_c + 0.01) - 1) * 100):.1f}%"
            ],
            strategy_d_name: [
                f"${current_k401_balance:,.0f}",
                f"${total_contrib_d:,.0f}",
                f"${final_d:,.0f}",
                f"${final_d - current_k401_balance - total_contrib_d:,.0f}",
                f"{((final_d / (current_k401_balance + total_contrib_d + 0.01) - 1) * 100):.1f}%"
            ]
        }
        
        comparison_df = pd.DataFrame(comparison_data)
        st.dataframe(comparison_df, use_container_width=True, hide_index=True)
        
        # Key insights
        st.subheader("💡 Key Insights")
        
        # Find the best strategy
        strategies = [
            (strategy_a_name, final_a, total_contrib_a),
            (strategy_b_name, final_b, total_contrib_b),
            (strategy_c_name, final_c, total_contrib_c),
            (strategy_d_name, final_d, total_contrib_d)
        ]
        best_strategy = max(strategies, key=lambda x: x[1])
        worst_strategy = min(strategies, key=lambda x: x[1])
        
        diff_best_worst = best_strategy[1] - worst_strategy[1]
        
        st.success(f"🏆 **Best Strategy: {best_strategy[0]}** with ${best_strategy[1]:,.0f}")
        st.write(f"📊 This is ${diff_best_worst:,.0f} more than the lowest strategy ({worst_strategy[0]})")
        
        # Compare switching strategies
        difference = final_a - final_b
        contrib_diff = total_contrib_a - total_contrib_b
        
        # Compare Always Max vs Always Match
        always_diff = final_c - final_d
        contrib_diff_always = total_contrib_c - total_contrib_d
        st.write(f"\n💵 **Always Max Out** contributes ${contrib_diff_always:,.0f} more than **Always Match Only** and results in ${always_diff:,.0f} higher balance.")
        
        with st.expander("🎯 Strategic Considerations"):
            st.write("""
            **Factors to Consider:**
            
            1. **Time Value of Money**: Earlier contributions have more time to compound
            
            2. **Cash Flow**: Can you afford to max out now? Or do you need that cash for other goals?
            
            3. **Tax Brackets**: If you expect to be in a higher tax bracket later, max out now for bigger deductions
            
            4. **Company Match**: Always contribute enough to get the full match - it's free money!
            
            5. **Other Goals**: Consider competing priorities (HSA, brokerage, debt payoff, emergency fund)
            
            6. **Market Timing**: Dollar-cost averaging through consistent contributions often beats trying to time the market
            
            **General Rule of Thumb:**
            - If you can afford it, max out early to maximize compounding
            - If cash flow is tight, prioritize company match first, then increase later
            - The difference often matters less than simply contributing consistently
            """)
        
        st.divider()
        
        # 401k vs Loan Payoff Analysis
        st.header("🏠 401(k) vs Home Loan Payoff Strategy")
        st.write("**Key Question:** Should you max out 401(k) now, or do company match only (6%) and use extra cash to pay off your home loan faster?")
        
        # Get loan data
        loan_data = user_data.get("home_loan_india", {})
        if loan_data.get("current_balance", 0) > 0:
            loan_balance = loan_data.get("current_balance", 0)
            loan_rate = loan_data.get("interest_rate", 8.05)
            loan_term_months = loan_data.get("term_months", 0)
            current_extra_payment = loan_data.get("extra_payment_monthly", 0)
            fx_rate = loan_data.get("fx_rate_usd_inr", 90.0)
            
            # Calculate current EMI
            monthly_emi_inr = loan.calculate_monthly_payment(loan_balance, loan_rate, loan_term_months)
            monthly_emi_usd = monthly_emi_inr / fx_rate
            
            st.subheader("📊 Strategy Comparison Setup")
            
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("Home Loan Balance (INR)", f"₹{loan_balance:,.0f}")
                st.metric("Loan Interest Rate", f"{loan_rate:.2f}%")
                st.metric("Current EMI (USD/month)", f"${monthly_emi_usd:,.0f}")
            
            with col2:
                analysis_years = st.slider(
                    "Analysis Timeframe (Years)",
                    min_value=5,
                    max_value=40,
                    value=min(30, max(15, loan_term_months // 12)),
                    step=1,
                    help="How many years to analyze total wealth"
                )
            
            with col3:
                k401_rate_loan_analysis = st.slider(
                    "Expected 401(k) Return (%)",
                    min_value=0.0,
                    max_value=15.0,
                    value=investment_growth.get("k401_annual_growth", 7.0),
                    step=0.5,
                    key="k401_rate_loan"
                )
            
            st.subheader("💰 Cash Flow Analysis")
            
            # Calculate the difference in contributions
            employee_max_contribution = k401_max_annual
            employee_match_contribution = estimated_employee_match_contrib
            extra_k401_pretax = employee_max_contribution - employee_match_contribution
            
            # Calculate tax savings difference
            marginal_rate = tax_info.get('marginal_tax_rate', 0.30)  # Federal + State marginal
            
            # If maxing 401k, you save taxes on the full amount
            # If only doing match, you only save on the match amount
            # The difference is the tax saved on extra_k401_pretax
            tax_savings_if_max = extra_k401_pretax * marginal_rate
            
            # After-tax cash available for loan payment if NOT maxing 401k
            extra_cash_for_loan_monthly = (extra_k401_pretax - tax_savings_if_max) / 12
            
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric(
                    "Max 401(k) Contribution",
                    f"${employee_max_contribution:,.0f}/yr",
                    help="Annual employee contribution when maxing out"
                )
            
            with col2:
                st.metric(
                    "Match-Only Contribution",
                    f"${employee_match_contribution:,.0f}/yr",
                    help="Annual employee contribution for company match (6%)"
                )
            
            with col3:
                st.metric(
                    "Difference (Pre-tax)",
                    f"${extra_k401_pretax:,.0f}/yr",
                    help="Extra you contribute when maxing out"
                )
            
            with col4:
                st.metric(
                    "After-Tax Cash for Loan",
                    f"${extra_cash_for_loan_monthly:,.0f}/mo",
                    help="Extra monthly cash available for loan if you don't max 401k"
                )
            
            st.info(f"💡 **Key Insight:** If you don't max out 401(k), you save ${extra_k401_pretax:,.0f}/year pre-tax, but only have ${extra_cash_for_loan_monthly * 12:,.0f}/year after-tax for loan payments (due to ${tax_savings_if_max:,.0f}/year tax savings lost).")
            
            st.subheader("📈 Scenario Analysis")
            
            # Scenario A: Max out 401k now, regular loan payments
            st.write("**Scenario A: Max Out 401(k), Regular Loan Payments**")
            
            k401_balance_a = current_k401_balance
            k401_balances_a = []
            loan_balance_a = loan_balance
            loan_balances_a = []
            total_wealth_a = []
            
            years_list_analysis = list(range(analysis_years + 1))
            
            for year in years_list_analysis:
                # Record balances
                k401_balances_a.append(k401_balance_a)
                loan_balances_a.append(loan_balance_a)
                total_wealth_a.append(k401_balance_a - (loan_balance_a / fx_rate))
                
                if year < analysis_years:
                    # 401k: max contribution + company match + growth
                    k401_contribution = employee_max_contribution + company_match
                    k401_balance_a = (k401_balance_a + k401_contribution) * (1 + k401_rate_loan_analysis / 100)
                    
                    # Loan: regular EMI payments (plus any current extra payments)
                    total_monthly_payment_inr = monthly_emi_inr + (current_extra_payment * fx_rate)
                    annual_payment_inr = total_monthly_payment_inr * 12
                    
                    # Calculate loan balance reduction
                    if loan_balance_a > 0:
                        monthly_rate = loan_rate / 100 / 12
                        remaining_months = loan_term_months - (year * 12)
                        
                        if remaining_months > 0:
                            for month in range(12):
                                if loan_balance_a > 0:
                                    interest = loan_balance_a * monthly_rate
                                    principal = total_monthly_payment_inr - interest
                                    loan_balance_a = max(0, loan_balance_a - principal)
                        else:
                            loan_balance_a = 0
            
            # Scenario B: Match-only 401k, accelerated loan payments, then max 401k
            st.write("**Scenario B: Match-Only 401(k) + Accelerate Loan, Then Max 401(k)**")
            
            k401_balance_b = current_k401_balance
            k401_balances_b = []
            loan_balance_b = loan_balance
            loan_balances_b = []
            total_wealth_b = []
            loan_payoff_year = None
            
            for year in years_list_analysis:
                # Record balances
                k401_balances_b.append(k401_balance_b)
                loan_balances_b.append(loan_balance_b)
                total_wealth_b.append(k401_balance_b - (loan_balance_b / fx_rate))
                
                if year < analysis_years:
                    loan_is_paid = loan_balance_b <= 0
                    
                    if not loan_is_paid:
                        # Still paying loan: match-only 401k
                        k401_contribution = employee_match_contribution + company_match
                        
                        # Extra loan payment using the after-tax cash
                        extra_monthly_loan_payment_usd = extra_cash_for_loan_monthly
                        extra_monthly_loan_payment_inr = extra_monthly_loan_payment_usd * fx_rate
                        
                        total_monthly_payment_inr = monthly_emi_inr + (current_extra_payment * fx_rate) + extra_monthly_loan_payment_inr
                        
                        # Pay down loan
                        monthly_rate = loan_rate / 100 / 12
                        for month in range(12):
                            if loan_balance_b > 0:
                                interest = loan_balance_b * monthly_rate
                                principal = total_monthly_payment_inr - interest
                                loan_balance_b = max(0, loan_balance_b - principal)
                        
                        if loan_balance_b <= 0 and loan_payoff_year is None:
                            loan_payoff_year = year + 1
                    else:
                        # Loan paid off: now max out 401k
                        k401_contribution = employee_max_contribution + company_match
                    
                    # Grow 401k
                    k401_balance_b = (k401_balance_b + k401_contribution) * (1 + k401_rate_loan_analysis / 100)
            
            # Display results
            final_k401_a = k401_balances_a[-1]
            final_loan_a = loan_balances_a[-1]
            final_wealth_a = total_wealth_a[-1]
            
            final_k401_b = k401_balances_b[-1]
            final_loan_b = loan_balances_b[-1]
            final_wealth_b = total_wealth_b[-1]
            
            wealth_difference = final_wealth_b - final_wealth_a
            
            st.subheader(f"📊 Results After {analysis_years} Years")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.write("**Scenario A: Max 401(k) Now**")
                st.metric("401(k) Balance", f"${final_k401_a:,.0f}")
                st.metric("Loan Balance (USD)", f"${final_loan_a / fx_rate:,.0f}")
                st.metric("Net Wealth", f"${final_wealth_a:,.0f}")
            
            with col2:
                st.write("**Scenario B: Pay Loan First**")
                st.metric("401(k) Balance", f"${final_k401_b:,.0f}")
                st.metric("Loan Balance (USD)", f"${final_loan_b / fx_rate:,.0f}")
                st.metric(
                    "Net Wealth", 
                    f"${final_wealth_b:,.0f}",
                    delta=f"${wealth_difference:,.0f}" if abs(wealth_difference) > 100 else "Same",
                    help="401(k) balance minus remaining loan"
                )
            
            if loan_payoff_year:
                st.success(f"🎉 **Loan Paid Off in Year {loan_payoff_year}** under Scenario B (accelerated payments)")
            
            # Charts
            st.subheader("📈 Wealth Accumulation Over Time")
            
            wealth_chart_df = pd.DataFrame({
                "Year": years_list_analysis,
                "Scenario A: Max 401(k) Now": total_wealth_a,
                "Scenario B: Pay Loan First": total_wealth_b
            })
            
            st.line_chart(wealth_chart_df.set_index("Year"))
            
            # Detailed breakdown
            col1, col2 = st.columns(2)
            
            with col1:
                st.write("**401(k) Balance Growth**")
                k401_chart_df = pd.DataFrame({
                    "Year": years_list_analysis,
                    "Scenario A": k401_balances_a,
                    "Scenario B": k401_balances_b
                })
                st.line_chart(k401_chart_df.set_index("Year"))
            
            with col2:
                st.write("**Loan Balance Over Time (USD)**")
                loan_chart_df = pd.DataFrame({
                    "Year": years_list_analysis,
                    "Scenario A": [bal / fx_rate for bal in loan_balances_a],
                    "Scenario B": [bal / fx_rate for bal in loan_balances_b]
                })
                st.line_chart(loan_chart_df.set_index("Year"))
            
            # Key insights
            st.subheader("💡 Analysis & Recommendation")
            
            if abs(wealth_difference) < 5000:
                st.info(f"📊 **Both strategies result in similar net wealth** (within ${abs(wealth_difference):,.0f}). Choose based on your risk tolerance and peace of mind.")
                st.write("- **Scenario A (Max 401k):** Better tax benefits now, but carries debt longer")
                st.write("- **Scenario B (Pay Loan):** Debt-free faster, but less tax-advantaged growth")
            elif wealth_difference > 0:
                st.success(f"✅ **Scenario B (Pay Loan First) wins by ${wealth_difference:,.0f}**")
                st.write(f"🎯 **Why:** The loan interest rate ({loan_rate:.2f}%) you save by paying it off early, combined with the psychological benefit of being debt-free, outweighs the opportunity cost.")
                st.write(f"📈 After paying off the loan in ~{loan_payoff_year} years, you can max out 401(k) with no debt burden.")
            else:
                st.success(f"✅ **Scenario A (Max 401k Now) wins by ${abs(wealth_difference):,.0f}**")
                st.write(f"🎯 **Why:** The expected 401(k) returns ({k401_rate_loan_analysis:.1f}%) plus tax benefits outweigh the loan interest ({loan_rate:.2f}%) you're paying.")
                st.write(f"💡 Consider this strategy if you're comfortable managing debt and confident in investment returns.")
            
            # Additional considerations
            with st.expander("🎯 Important Considerations"):
                st.write(f"""
                **Mathematical Factors:**
                - 401(k) Expected Return: {k401_rate_loan_analysis:.1f}% (pre-tax, tax-deferred growth)
                - Loan Interest Rate: {loan_rate:.2f}% (after-tax money paying this)
                - Marginal Tax Rate: {marginal_rate * 100:.1f}% (tax savings on 401k contributions)
                - FX Risk: USD/INR rate changes affect loan burden
                
                **Break-Even Analysis:**
                - If 401(k) returns > {loan_rate:.2f}% after taxes, maxing 401(k) wins mathematically
                - Effective loan cost: {loan_rate:.2f}% (can't deduct this interest in US taxes for foreign property)
                - Effective 401(k) benefit: {k401_rate_loan_analysis:.1f}% returns + {marginal_rate * 100:.1f}% tax savings upfront
                
                **Non-Financial Factors:**
                
                1. **Peace of Mind:** Being debt-free has psychological value that's hard to quantify
                
                2. **Risk Tolerance:** 
                   - Max 401(k): Higher upside if markets perform well, but carry debt longer
                   - Pay Loan: Guaranteed "return" = loan interest saved, no market risk
                
                3. **FX Exposure:** Paying loan faster reduces currency risk if INR strengthens
                
                4. **Flexibility:** No loan = more cash flow flexibility for other opportunities
                
                5. **Job Security:** If job is uncertain, being debt-free provides more security
                
                6. **Retirement Timing:** If retiring soon, may want to be debt-free first
                
                **Recommendation Framework:**
                - If loan rate > 6% → Strongly consider paying it off first
                - If loan rate < 4% AND you're confident in 401k returns → Max 401k
                - If loan rate 4-6% → It's a close call, choose based on personal preferences
                - Always keep an emergency fund regardless of strategy
                """)
        
        else:
            st.warning("⚠️ No home loan data found. Please configure your home loan in the 'Home Loan' tab to see this analysis.")
    
    except Exception as e:
        st.error(f"Error in investment strategy analysis: {e}")
        st.write("Please ensure your financial data is configured in other tabs.")


def main():
    """Main Streamlit app."""
    st.set_page_config(
        page_title="Budget Planner",
        page_icon="💰",
        layout="wide",
    )
    
    init_session_state()
    
    # Sidebar
    st.sidebar.title("💰 Budget Planner")
    
    # User selector
    available_users = data_store.list_users()
    if available_users:
        selected_user = st.sidebar.selectbox(
            "Select User",
            available_users,
            index=available_users.index(st.session_state.current_user) if st.session_state.current_user in available_users else 0
        )
        if selected_user != st.session_state.current_user:
            st.session_state.current_user = selected_user
            st.rerun()
    else:
        st.sidebar.warning("No users found. Run seed_data.py first.")
    
    st.sidebar.divider()
    st.sidebar.info("Build your tax-optimized budget with detailed account projections.")
    
    # Main title
    st.title("💰 Budget Planner")
    
    # Prediction period slider
    col1, col2 = st.columns([3, 1])
    with col1:
        st.session_state.prediction_months = st.slider(
            "Prediction Period",
            min_value=3,
            max_value=60,
            value=st.session_state.prediction_months,
            step=1,
            help="Number of months to project"
        )
    
    # Live projection summary - always visible
    username = st.session_state.current_user
    
    try:
        projection_df = budget.project_accounts(username, st.session_state.prediction_months)
        
        if not projection_df.empty:
            st.subheader(f"📊 {st.session_state.prediction_months}-Month Projection Summary")
            
            last_row = projection_df.iloc[-1]
            
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                current = load_user_data(username)["account_balances"]["savings"]
                projected = last_row['savings_balance']
                delta = projected - current
                st.metric("Savings", f"${projected:,.0f}", delta=f"${delta:,.0f}")
            
            with col2:
                current = load_user_data(username)["account_balances"]["k401"]
                projected = last_row['k401_balance']
                delta = projected - current
                st.metric("401(k)", f"${projected:,.0f}", delta=f"${delta:,.0f}")
            
            with col3:
                current = load_user_data(username)["account_balances"]["hsa"]
                projected = last_row['hsa_balance']
                delta = projected - current
                st.metric("HSA", f"${projected:,.0f}", delta=f"${delta:,.0f}")
            
            with col4:
                current = load_user_data(username)["account_balances"]["brokerage"]
                projected = last_row['brokerage_balance']
                delta = projected - current
                st.metric("Brokerage", f"${projected:,.0f}", delta=f"${delta:,.0f}")
            
            st.divider()
    
    except Exception as e:
        st.warning("⚠️ Configure your financial data in the tabs below to see projections.")
    
    # Main tabs
    tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8 = st.tabs([
        "💰 Income & Taxes",
        "💸 Expenses",
        "💎 Savings",
        "🔮 What-If Scenarios",
        "🏠 Home Loan",
        "📊 Investment Strategies",
        "📈 Projections",
        "📐 Max Budget"
    ])
    
    with tab1:
        tab_income_tax()
    
    with tab2:
        tab_expenses()
    
    with tab3:
        tab_savings()
    
    with tab4:
        tab_scenarios()
    
    with tab5:
        tab_home_loan()
    
    with tab6:
        tab_investment_strategies()
    
    with tab7:
        tab_projections()
    
    with tab8:
        tab_max_budget()


if __name__ == "__main__":
    main()
